import type { ToolManifest, ToolState } from '@jm/suite-manifest';

export type { ToolManifest, ToolState, ToolCategory, InstallStatus } from '@jm/suite-manifest';

/** Ergebnis einer Launcher-Aktion (öffnen/installieren/aktualisieren). */
export interface ActionResult {
  ok: boolean;
  message?: string;
}

/** Die unter `window.jmps` bereitgestellte Launcher-API. */
export interface JmpsApi {
  platform: NodeJS.Platform;
  listTools: () => Promise<ToolManifest[]>;
  getState: () => Promise<ToolState[]>;
  open: (id: string) => Promise<ActionResult>;
  install: (id: string) => Promise<ActionResult>;
  update: (id: string) => Promise<ActionResult>;
  openExternal: (url: string) => Promise<void>;
}
