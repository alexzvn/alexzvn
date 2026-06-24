import { z } from 'zod';

// Blackmagic ATEM: festes UDP-Protokoll auf Port 9910 (von atem-connection
// gehandhabt) → nur Host nötig. M/E 1 (Index 0) wird gesteuert.
export const AtemConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  host: z.string().min(1),
});
export type AtemConfig = z.infer<typeof AtemConfigSchema>;

export const AtemConfigListSchema = z.array(AtemConfigSchema);
export type AtemConfigList = z.infer<typeof AtemConfigListSchema>;

export type AtemConnectionState = 'connected' | 'connecting' | 'down';

export interface AtemStatus {
  id: string;
  state: AtemConnectionState;
  /** Produktname (z. B. „ATEM Mini Pro"). */
  model?: string;
  /** Programm-Eingang (M/E 1). */
  program?: number;
  /** Preview-Eingang (M/E 1). */
  preview?: number;
  recording?: boolean;
  streaming?: boolean;
  lastChecked: number;
  lastError?: string;
}

// Steuerbefehle. `on` weggelassen = umschalten (Toggle).
export const AtemCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('program'), input: z.number().int().nonnegative() }),
  z.object({ type: z.literal('preview'), input: z.number().int().nonnegative() }),
  z.object({ type: z.literal('cut') }),
  z.object({ type: z.literal('auto') }),
  z.object({ type: z.literal('ftb') }),
  z.object({ type: z.literal('key'), keyer: z.number().int().nonnegative(), on: z.boolean().optional() }),
  z.object({ type: z.literal('record'), on: z.boolean().optional() }),
  z.object({ type: z.literal('stream'), on: z.boolean().optional() }),
]);
export type AtemCommand = z.infer<typeof AtemCommandSchema>;
