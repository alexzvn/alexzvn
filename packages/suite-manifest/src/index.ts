import suiteData from '../suite.json';
import type { SuiteManifest, ToolManifest } from './types';

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
