import { SUITE } from '@jm/suite-manifest';
import type { ToolManifest } from '@jm/suite-manifest';

/**
 * Quelle der Tool-Registry. Phase 1: lokal gebündeltes suite.json.
 * Phase 3: hier zusätzlich eine remote gehostete suite.json laden und cachen.
 */
export function getTools(): ToolManifest[] {
  return SUITE.tools;
}

export function getTool(id: string): ToolManifest | undefined {
  return SUITE.tools.find((t) => t.id === id);
}
