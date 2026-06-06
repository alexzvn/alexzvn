import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SuiteSettingsInput, SuiteSettingsView } from '@shared/types';

interface StoredSettings {
  githubToken?: string;
  proxyUrl?: string;
  manifestUrl?: string;
}

function settingsFile(): string {
  return join(app.getPath('userData'), 'settings.json');
}

function read(): StoredSettings {
  try {
    if (existsSync(settingsFile())) {
      return JSON.parse(readFileSync(settingsFile(), 'utf8')) as StoredSettings;
    }
  } catch {
    // korrupte Datei ignorieren und mit Default weitermachen
  }
  return {};
}

function write(value: StoredSettings): void {
  mkdirSync(app.getPath('userData'), { recursive: true });
  writeFileSync(settingsFile(), JSON.stringify(value, null, 2));
}

/** Effektives Token: Umgebungsvariable hat Vorrang vor gespeichertem Wert. */
export function resolveToken(): string | undefined {
  return process.env['JMPS_GITHUB_TOKEN'] || read().githubToken || undefined;
}

/** Effektive Proxy-URL: Umgebungsvariable hat Vorrang. */
export function resolveProxy(): string | undefined {
  return process.env['JMPS_RELEASE_PROXY'] || read().proxyUrl || undefined;
}

/** Effektive Remote-Manifest-URL (suite.json): Umgebungsvariable hat Vorrang. */
export function resolveManifestUrl(): string | undefined {
  return process.env['JMPS_MANIFEST_URL'] || read().manifestUrl || undefined;
}

function envControlled(): boolean {
  return Boolean(process.env['JMPS_GITHUB_TOKEN'] || process.env['JMPS_RELEASE_PROXY']);
}

export function getSettingsView(): SuiteSettingsView {
  const proxy = resolveProxy();
  const token = resolveToken();
  const source: SuiteSettingsView['source'] = proxy ? 'proxy' : token ? 'github' : 'none';
  return {
    hasToken: Boolean(token),
    proxyUrl: proxy,
    source,
    fromEnv: envControlled(),
    manifestUrl: resolveManifestUrl(),
    manifestFromEnv: Boolean(process.env['JMPS_MANIFEST_URL']),
  };
}

export function setSettings(input: SuiteSettingsInput): SuiteSettingsView {
  const current = read();
  const next: StoredSettings = { ...current };
  // Leerer String => Wert löschen; undefined => unverändert lassen.
  if (input.githubToken !== undefined) {
    next.githubToken = input.githubToken.trim() || undefined;
  }
  if (input.proxyUrl !== undefined) {
    next.proxyUrl = input.proxyUrl.trim() || undefined;
  }
  if (input.manifestUrl !== undefined) {
    next.manifestUrl = input.manifestUrl.trim() || undefined;
  }
  write(next);
  return getSettingsView();
}
