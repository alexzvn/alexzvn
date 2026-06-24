import { z } from 'zod';

// OBS WebSocket v5 (obs-websocket-js) — Standardport 4455, optionales Passwort.
export const DEFAULT_OBS_PORT = 4455;

export const ObsConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  host: z.string().min(1),
  port: z.number().int().positive(),
  /** obs-websocket-Passwort (falls in OBS gesetzt). */
  password: z.string().optional(),
});
export type ObsConfig = z.infer<typeof ObsConfigSchema>;

export const ObsConfigListSchema = z.array(ObsConfigSchema);
export type ObsConfigList = z.infer<typeof ObsConfigListSchema>;

export type ObsConnectionState = 'connected' | 'connecting' | 'down';

export interface ObsStatus {
  id: string;
  state: ObsConnectionState;
  /** Aktuelle Programm-Szene. */
  currentScene?: string;
  /** Verfügbare Szenen (Reihenfolge wie in OBS, oben = aktuell oben). */
  scenes?: string[];
  recording?: boolean;
  streaming?: boolean;
  lastChecked: number;
  lastError?: string;
}

// Steuerbefehle vom Renderer. `on` weggelassen = umschalten (Toggle).
export const ObsCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('scene'), scene: z.string().min(1) }),
  z.object({ type: z.literal('record'), on: z.boolean().optional() }),
  z.object({ type: z.literal('stream'), on: z.boolean().optional() }),
]);
export type ObsCommand = z.infer<typeof ObsCommandSchema>;
