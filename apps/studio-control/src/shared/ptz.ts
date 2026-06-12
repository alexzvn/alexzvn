import { z } from 'zod';

// Panasonic AW-series PTZ cameras (AW-UE150, AW-UE100, AW-HE130, …) expose an
// HTTP CGI control API on the standard HTTP port:
//   http://<ip>/cgi-bin/aw_ptz?cmd=<command>&res=1   — pan/tilt/zoom/focus/preset/power
//   http://<ip>/cgi-bin/aw_cam?cmd=<command>&res=1   — lens / camera parameters
// `#` in the command must be URL-encoded (%23); URLSearchParams handles that.
//
// The exact command strings follow Panasonic's published "AW Series HD
// Integrated Camera — Interface Specifications". They are kept here so they are
// shared between main + renderer and unit-testable, and so they can be smoke-
// tested against the mock camera (tools/mock-ptz.ts) without real hardware.
export const DEFAULT_PTZ_PORT = 80;

export const PtzCameraConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  host: z.string().min(1),
  port: z.number().int().positive(),
  model: z.string().optional(),
});
export type PtzCameraConfig = z.infer<typeof PtzCameraConfigSchema>;

export const PtzCameraConfigListSchema = z.array(PtzCameraConfigSchema);
export type PtzCameraConfigList = z.infer<typeof PtzCameraConfigListSchema>;

export type PtzConnectionState = 'connected' | 'polling' | 'down';

export interface PtzStatus {
  id: string;
  state: PtzConnectionState;
  /** Power state from the `#O` query, when reachable. */
  power?: 'on' | 'standby';
  lastChecked: number;
  lastError?: string;
}

// Number of preset slots shown in the recall grid. AW cameras address presets
// 00–99; we expose 1..PTZ_PRESET_COUNT mapped 1:1 onto the AW preset number.
export const PTZ_PRESET_COUNT = 12;

// Drive-speed magnitudes (0 = stop, 49 = max) offered as slow/medium/fast steps.
export const PTZ_SPEEDS = { slow: 12, med: 28, fast: 45 } as const;
export type PtzSpeed = keyof typeof PTZ_SPEEDS;

// ===== Control actions (transport-agnostic; the driver maps them to AW CGI) ===

export const PtzActionSchema = z.discriminatedUnion('kind', [
  // pan/tilt: -49..49 each, 0 = stop. Positive pan = right, positive tilt = up.
  z.object({ kind: z.literal('pan-tilt'), pan: z.number().int(), tilt: z.number().int() }),
  // zoom: -49..49, 0 = stop. Positive = tele (in), negative = wide (out).
  z.object({ kind: z.literal('zoom'), speed: z.number().int() }),
  // focus: -49..49, 0 = stop. Positive = far, negative = near.
  z.object({ kind: z.literal('focus'), speed: z.number().int() }),
  z.object({ kind: z.literal('autofocus'), on: z.boolean() }),
  z.object({ kind: z.literal('preset-recall'), preset: z.number().int().min(0).max(99) }),
  z.object({ kind: z.literal('preset-store'), preset: z.number().int().min(0).max(99) }),
  z.object({ kind: z.literal('power'), on: z.boolean() }),
]);
export type PtzAction = z.infer<typeof PtzActionSchema>;

export interface AwCommand {
  cgi: 'aw_ptz' | 'aw_cam';
  /** Raw command incl. leading `#` — the client URL-encodes it. */
  cmd: string;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

/** Map a -49..49 drive value onto the AW 01–99 scale (50 = stop). */
function speedField(n: number): string {
  return pad2(clamp(n, -49, 49) + 50);
}

/** Translate a transport-agnostic action into its AW CGI command. */
export function buildAwCommand(a: PtzAction): AwCommand {
  switch (a.kind) {
    case 'pan-tilt':
      return { cgi: 'aw_ptz', cmd: `#PTS${speedField(a.pan)}${speedField(a.tilt)}` };
    case 'zoom':
      return { cgi: 'aw_ptz', cmd: `#Z${speedField(a.speed)}` };
    case 'focus':
      return { cgi: 'aw_ptz', cmd: `#F${speedField(a.speed)}` };
    case 'autofocus':
      return { cgi: 'aw_ptz', cmd: `#D1${a.on ? '1' : '0'}` };
    case 'preset-recall':
      return { cgi: 'aw_ptz', cmd: `#R${pad2(a.preset)}` };
    case 'preset-store':
      return { cgi: 'aw_ptz', cmd: `#M${pad2(a.preset)}` };
    case 'power':
      return { cgi: 'aw_ptz', cmd: `#O${a.on ? '1' : '0'}` };
  }
}

/** The no-motion stop action — sent on joystick / button release. */
export const PTZ_STOP: PtzAction = { kind: 'pan-tilt', pan: 0, tilt: 0 };
