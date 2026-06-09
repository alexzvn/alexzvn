// JM Production Suite — Release-Proxy (Cloudflare Worker)
//
// Hält EIN GitHub-Token serverseitig und liefert den Clients (Launcher) pro Tool
// die neueste Version + eine zeitlich begrenzte, signierte Download-URL. Damit
// braucht KEIN Client ein GitHub-Token. Zugriff auf den Proxy selbst wird über
// einen einfachen Proxy-Key geschützt.
//
// Vertrag (entspricht ProxyReleaseSource im Launcher):
//   GET /tools/:id/latest?platform=<mac|win>&arch=<arm64|x64>
//   Header: X-Proxy-Key: <PROXY_KEY>   (oder Authorization: Bearer <PROXY_KEY>)
//   → 200 { version, assets: { <platform>: { url, size, fileName } } }
//
// Secrets (verschlüsselt, via `wrangler secret put` oder Dashboard):
//   GITHUB_TOKEN  fine-grained PAT, read-only Contents auf REPO
//   PROXY_KEY     gemeinsamer Key, den die Clients mitschicken
// Variable (Klartext, in wrangler.toml [vars]):
//   REPO          z. B. "AlexmachtCode/alexzvn"

const USER_AGENT = 'JM-Suite-Release-Proxy';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Health-Check ohne Key (verrät nichts Sensibles).
    if (request.method === 'GET' && url.pathname === '/') {
      return text('JM Production Suite release proxy — ok');
    }

    // Ab hier: Proxy-Key Pflicht.
    const provided =
      request.headers.get('X-Proxy-Key') ||
      (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!env.PROXY_KEY || provided !== env.PROXY_KEY) {
      return json({ error: 'unauthorized' }, 401);
    }

    // Feedback (Bug/Wunsch) aus dem Launcher → serverseitig ein GitHub-Issue
    // anlegen, damit die Clients tokenlos bleiben. Braucht GITHUB_TOKEN mit
    // Berechtigung issues:write auf REPO.
    if (request.method === 'POST' && url.pathname === '/feedback') {
      let payload;
      try {
        payload = await request.json();
      } catch {
        return json({ error: 'ungültiges JSON' }, 400);
      }
      const title = String((payload && payload.title) || '').trim();
      const description = String((payload && payload.description) || '').trim();
      if (!title || !description) {
        return json({ error: 'title und description erforderlich' }, 400);
      }
      const isBug = payload && payload.type === 'bug';
      const context = String((payload && payload.context) || '').trim();
      const body =
        description +
        '\n\n---\n_Aus dem JM Production Suite Launcher gemeldet_' +
        (context ? `\n\n\`\`\`\n${context}\n\`\`\`` : '');
      try {
        const res = await fetch(`https://api.github.com/repos/${env.REPO}/issues`, {
          method: 'POST',
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${env.GITHUB_TOKEN}`,
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': USER_AGENT,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            title: `[${isBug ? 'Bug' : 'Wunsch'}] ${title}`,
            body,
            labels: [isBug ? 'bug' : 'enhancement', 'from-launcher'],
          }),
        });
        if (!res.ok) {
          const detail = await res.text().catch(() => '');
          return json({ error: `GitHub ${res.status}`, detail: detail.slice(0, 300) }, 502);
        }
        const issue = await res.json();
        return json({ ok: true, number: issue.number, url: issue.html_url });
      } catch (e) {
        return json({ error: String((e && e.message) || e) }, 502);
      }
    }

    // Katalog (suite.json) LIVE aus dem Repo ausliefern — git ist die einzige
    // Quelle der Wahrheit, damit neue Tools ohne Launcher-Release oder Worker-
    // Deploy erscheinen (nur `suite.json` committen). Ref = env.MANIFEST_REF.
    if (request.method === 'GET' && url.pathname === '/suite.json') {
      try {
        const ref = env.MANIFEST_REF || 'main';
        const path = env.MANIFEST_PATH || 'packages/suite-manifest/suite.json';
        const raw = await ghRaw(
          `https://api.github.com/repos/${env.REPO}/contents/${path}?ref=${encodeURIComponent(ref)}`,
          env,
        );
        return new Response(raw, {
          status: 200,
          headers: {
            'content-type': 'application/json; charset=utf-8',
            // kurz cachen; Clients holen ohnehin nur beim Start
            'cache-control': 'public, max-age=60',
          },
        });
      } catch (e) {
        return json({ error: String((e && e.message) || e) }, 502);
      }
    }

    const match = url.pathname.match(/^\/tools\/([^/]+)\/latest\/?$/);
    if (request.method !== 'GET' || !match) {
      return json({ error: 'not found' }, 404);
    }

    const id = decodeURIComponent(match[1]);
    const platform = url.searchParams.get('platform');
    const arch = url.searchParams.get('arch') || 'x64';
    if (platform !== 'mac' && platform !== 'win') {
      return json({ error: 'query "platform" erforderlich (mac|win)' }, 400);
    }

    // Tool-ID → Tag-Präfix: "jm-copy" → "copy-v", "launcher" → "launcher-v".
    const app = id.startsWith('jm-') ? id.slice(3) : id;
    const prefix = `${app}-v`;

    try {
      const releases = await ghJson(
        `https://api.github.com/repos/${env.REPO}/releases?per_page=100`,
        env,
      );
      const picked = releases
        .filter((r) => !r.draft && typeof r.tag_name === 'string' && r.tag_name.startsWith(prefix))
        .map((r) => ({ release: r, version: r.tag_name.slice(prefix.length) }))
        .sort((a, b) => compareVersions(b.version, a.version))[0];
      if (!picked) return json({ error: `kein Release für ${app}` }, 404);

      const ext = platform === 'mac' ? '.dmg' : '.exe';
      const assets = picked.release.assets || [];
      // Auf macOS zusätzlich nach Architektur filtern (arm64/x64-DMG), sonst nur
      // nach Endung. GitHub ersetzt Leerzeichen in Asset-Namen durch Punkte.
      const asset =
        assets.find(
          (a) => a.name.endsWith(ext) && (platform === 'mac' ? a.name.includes(arch) : true),
        ) || assets.find((a) => a.name.endsWith(ext));
      if (!asset) return json({ error: `kein ${platform}-Asset im Release` }, 404);

      const signedUrl = await resolveSignedUrl(env.REPO, asset.id, env);
      if (!signedUrl) return json({ error: 'Download-URL nicht auflösbar' }, 502);

      return json({
        version: picked.version,
        assets: {
          [platform]: { url: signedUrl, size: asset.size, fileName: asset.name },
        },
      });
    } catch (e) {
      return json({ error: String((e && e.message) || e) }, 502);
    }
  },
};

/** GitHub-JSON mit Server-Token holen. */
async function ghJson(apiUrl, env) {
  const res = await fetch(apiUrl, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': USER_AGENT,
    },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status} ${res.statusText}`);
  return res.json();
}

/** Rohinhalt einer Datei aus dem Repo holen (Contents-API, raw). */
async function ghRaw(apiUrl, env) {
  const res = await fetch(apiUrl, {
    headers: {
      Accept: 'application/vnd.github.raw',
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': USER_AGENT,
    },
  });
  if (!res.ok) throw new Error(`GitHub contents ${res.status} ${res.statusText}`);
  return res.text();
}

/**
 * Löst die signierte Storage-URL eines Assets auf: Der Asset-Endpoint mit
 * `Accept: octet-stream` antwortet mit 302 auf eine signierte, auth-freie URL.
 * `redirect: 'manual'` lässt den Worker die `Location` lesen, statt zu folgen.
 */
async function resolveSignedUrl(repo, assetId, env) {
  const res = await fetch(`https://api.github.com/repos/${repo}/releases/assets/${assetId}`, {
    headers: {
      Accept: 'application/octet-stream',
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      'User-Agent': USER_AGENT,
    },
    redirect: 'manual',
  });
  const location = res.headers.get('Location');
  if (location) return location;
  // Falls die Laufzeit doch gefolgt ist: finale URL nehmen.
  if (res.ok && res.url) return res.url;
  return null;
}

/** Dotted-Versionsvergleich; >0 wenn a neuer als b. */
function compareVersions(a, b) {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function text(body, status = 200) {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
