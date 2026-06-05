import type { Platform, ToolManifest } from '@jm/suite-manifest';
import { resolveProxy, resolveToken } from './settings';

/** Aufgelöstes, herunterladbares Release-Artefakt für die aktuelle Plattform. */
export interface ResolvedAsset {
  version: string;
  fileName: string;
  /** URL, von der das Binär geladen wird. */
  assetUrl: string;
  /** Bekannte Größe in Bytes (0, falls unbekannt). */
  size: number;
  /** Header für den Download-Request (z. B. GitHub-Auth). */
  downloadHeaders: Record<string, string>;
}

/** Abstraktion über die Herkunft der Release-Artefakte (GitHub-PAT, Proxy, …). */
export interface ReleaseSource {
  latest(tool: ToolManifest): Promise<ResolvedAsset | null>;
}

function platformKey(): Platform | null {
  if (process.platform === 'darwin') return 'mac';
  if (process.platform === 'win32') return 'win';
  return null;
}

function archToken(): string {
  return process.arch === 'arm64' ? 'arm64' : 'x64';
}

/** Erwarteter Artefaktname aus dem Manifest mit aufgelösten Platzhaltern. */
function resolveArtifactName(tool: ToolManifest, version: string): string | null {
  const key = platformKey();
  if (!key) return null;
  const info = tool.platforms[key];
  if (!info) return null;
  return info.artifact
    .replace(/\$\{version\}/g, version)
    .replace(/\$\{arch\}/g, archToken());
}

const USER_AGENT = 'JM-Production-Suite';

/** GitHub-Releases einer privaten Repo via fine-grained PAT (read-only contents). */
class GithubReleaseSource implements ReleaseSource {
  constructor(private readonly token: string) {}

  async latest(tool: ToolManifest): Promise<ResolvedAsset | null> {
    const api = `https://api.github.com/repos/${tool.repo}/releases/latest`;
    const res = await fetch(api, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${this.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': USER_AGENT,
      },
    });
    if (!res.ok) {
      throw new Error(`GitHub API ${res.status} ${res.statusText}`);
    }
    const json = (await res.json()) as {
      tag_name: string;
      assets: Array<{ id: number; name: string; size: number }>;
    };
    const version = json.tag_name.replace(/^v/, '');
    const wanted = resolveArtifactName(tool, version);
    const ext = platformKey() === 'mac' ? '.dmg' : '.exe';
    const asset =
      (wanted && json.assets.find((a) => a.name === wanted)) ||
      json.assets.find((a) => a.name.endsWith(ext) && a.name.includes(version));
    if (!asset) return null;

    return {
      version,
      fileName: asset.name,
      // Asset-Endpoint mit octet-stream → GitHub leitet auf eine signierte URL um;
      // fetch entfernt beim Cross-Origin-Redirect den Authorization-Header (korrekt für S3).
      assetUrl: `https://api.github.com/repos/${tool.repo}/releases/assets/${asset.id}`,
      size: asset.size,
      downloadHeaders: {
        Accept: 'application/octet-stream',
        Authorization: `Bearer ${this.token}`,
        'User-Agent': USER_AGENT,
      },
    };
  }
}

/**
 * Interner Proxy: hält das Token serverseitig und liefert Metadaten + Asset-URL.
 * Erwartetes Format von GET {base}/tools/{id}/latest:
 *   { version, assets: { mac?: {url,size,fileName}, win?: {url,size,fileName} } }
 */
class ProxyReleaseSource implements ReleaseSource {
  constructor(private readonly base: string) {}

  async latest(tool: ToolManifest): Promise<ResolvedAsset | null> {
    const key = platformKey();
    if (!key) return null;
    const url = `${this.base.replace(/\/$/, '')}/tools/${tool.id}/latest`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      throw new Error(`Proxy ${res.status} ${res.statusText}`);
    }
    const json = (await res.json()) as {
      version: string;
      assets: Partial<Record<Platform, { url: string; size: number; fileName: string }>>;
    };
    const asset = json.assets[key];
    if (!asset) return null;
    return {
      version: json.version,
      fileName: asset.fileName,
      assetUrl: asset.url,
      size: asset.size,
      downloadHeaders: {},
    };
  }
}

/**
 * Wählt die aktive Release-Quelle: Proxy bevorzugt (kein Token im Client),
 * sonst GitHub-PAT, sonst keine (manueller Download via Release-Seite).
 */
export function getReleaseSource(): ReleaseSource | null {
  const proxy = resolveProxy();
  if (proxy) return new ProxyReleaseSource(proxy);
  const token = resolveToken();
  if (token) return new GithubReleaseSource(token);
  return null;
}
