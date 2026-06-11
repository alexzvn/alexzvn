import suiteData from '../suite.json';
import changelogData from '../changelog.json';
import type { AppChangelog, ChangelogEntry, SuiteManifest, ToolManifest } from './types';

export * from './types';

/** Die gebündelte Tool-Registry (lokale Quelle, Phase 1). */
export const SUITE: SuiteManifest = suiteData as SuiteManifest;

/** Alle Tools, nach Anzeigename sortiert. */
export function listTools(): ToolManifest[] {
  return [...SUITE.tools];
}

/** Ein Tool per ID nachschlagen. */
export function findTool(id: string): ToolManifest | undefined {
  return SUITE.tools.find((t) => t.id === id);
}

/**
 * Gebündelte Patch Notes (Offline-Fallback). Live wird dieselbe `changelog.json`
 * vom Release-Proxy aus dem Katalog-Branch geliefert (siehe Launcher), sodass
 * neue App-Notes ohne Launcher-Release erscheinen.
 */
export const CHANGELOG: AppChangelog[] = changelogData as AppChangelog[];

/** Patch Notes einer App (oder undefined). */
export function changelogFor(app: string, data: AppChangelog[] = CHANGELOG): AppChangelog | undefined {
  return data.find((c) => c.app === app);
}

/** Eintrag einer bestimmten Version (oder undefined, wenn nicht dokumentiert). */
export function entryFor(
  app: string,
  version: string,
  data: AppChangelog[] = CHANGELOG,
): ChangelogEntry | undefined {
  return changelogFor(app, data)?.entries.find((e) => e.version === version);
}
