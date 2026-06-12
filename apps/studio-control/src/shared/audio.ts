import { z } from 'zod';

// Audio mixer control for the studio. Two consoles are supported with selectable
// transports. The native control paths are what actually work in the studio:
//   - Yamaha QL1  → RCP/SCP, an ASCII line protocol over TCP 49280.
//   - Allen&Heath SQ5 → MIDI over TCP 51325 (NRPN faders, Note-On mutes).
// "OSC" is a generic OSC/UDP transport for a bridge/relay (neither console
// speaks OSC natively). "Dante" is the audio transport, not a mixer-control
// protocol — selecting it here means "reach the native control protocol over
// the console's Dante-network IP". The exact wire values for the SQ MIDI taper
// are best-effort and flagged; confirm against the real desk.

export const CONSOLE_TYPES = ['yamaha-ql', 'ah-sq'] as const;
export type ConsoleType = (typeof CONSOLE_TYPES)[number];

export const AUDIO_TRANSPORTS = ['tcp', 'osc', 'dante'] as const;
export type AudioTransport = (typeof AUDIO_TRANSPORTS)[number];

/** Native TCP control port per console. */
export const DEFAULT_CONTROL_PORTS: Record<ConsoleType, number> = {
  'yamaha-ql': 49280, // Yamaha RCP/SCP
  'ah-sq': 51325, // Allen & Heath SQ MIDI-over-TCP
};
export const DEFAULT_OSC_PORT = 8000;

export interface ConsoleProfile {
  id: ConsoleType;
  name: string;
  /** Mono input channels the strip grid offers. */
  inputCount: number;
  /** Whether the native transport is TCP-text (Yamaha) or TCP-MIDI (A&H). */
  native: 'yamaha-rcp' | 'ah-midi';
}

export const CONSOLE_PROFILES: ConsoleProfile[] = [
  { id: 'yamaha-ql', name: 'Yamaha QL1', inputCount: 32, native: 'yamaha-rcp' },
  { id: 'ah-sq', name: 'Allen & Heath SQ5', inputCount: 48, native: 'ah-midi' },
];

export function consoleProfile(type: ConsoleType): ConsoleProfile {
  return CONSOLE_PROFILES.find((p) => p.id === type) ?? CONSOLE_PROFILES[0]!;
}

export const AUDIO_TRANSPORT_LABELS: Record<AudioTransport, string> = {
  tcp: 'TCP (nativ)',
  osc: 'OSC (Bridge/Relay)',
  dante: 'Dante-Netz (nativ über Dante-IP)',
};

export function defaultPortFor(type: ConsoleType, transport: AudioTransport): number {
  return transport === 'osc' ? DEFAULT_OSC_PORT : DEFAULT_CONTROL_PORTS[type];
}

// ===== Fader law =====
// Faders are expressed in dB across a working range; mute is a separate control.
export const FADER_MIN_DB = -60;
export const FADER_MAX_DB = 10;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Yamaha RCP level units: +10 dB = 1000, 0 dB = 0 (0.01 dB per unit). */
export function dbToYamaha(db: number): number {
  return Math.round(clamp(db, -327.68, 10) * 100);
}

/**
 * Allen & Heath SQ fader as a 14-bit value. The real SQ uses a level lookup
 * table — this is a linear-in-dB approximation across the working range and is
 * flagged for confirmation against the desk. Returns { msb, lsb } (7-bit each).
 */
export function dbToSq14(db: number): { msb: number; lsb: number } {
  const norm = clamp((db - FADER_MIN_DB) / (FADER_MAX_DB - FADER_MIN_DB), 0, 1);
  const v = Math.round(norm * 0x3fff);
  return { msb: (v >> 7) & 0x7f, lsb: v & 0x7f };
}

// ===== Control actions (transport-agnostic) =====

export const AudioActionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('fader'), channel: z.number().int().min(1).max(64), db: z.number() }),
  z.object({ kind: z.literal('mute'), channel: z.number().int().min(1).max(64), on: z.boolean() }),
]);
export type AudioAction = z.infer<typeof AudioActionSchema>;

// ===== Generic OSC address scheme (for the bridge transport) =====

export interface OscArg {
  type: 'i' | 'f' | 's';
  value: number | string;
}
export interface OscMessage {
  address: string;
  args: OscArg[];
}

/** Map an action to our documented bridge OSC scheme: /sc/<type>/ch/<n>/<param>. */
export function oscMessageFor(type: ConsoleType, action: AudioAction): OscMessage {
  const base = `/sc/${type}/ch/${action.channel}`;
  if (action.kind === 'fader') {
    return { address: `${base}/level`, args: [{ type: 'f', value: Number(action.db.toFixed(2)) }] };
  }
  return { address: `${base}/mute`, args: [{ type: 'i', value: action.on ? 1 : 0 }] };
}

// ===== Persisted state =====

export const ChannelStateSchema = z.object({
  ch: z.number().int().min(1).max(64),
  db: z.number(),
  mute: z.boolean(),
});
export type ChannelState = z.infer<typeof ChannelStateSchema>;

export const AudioConsoleConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(CONSOLE_TYPES),
  transport: z.enum(AUDIO_TRANSPORTS),
  host: z.string().min(1),
  port: z.number().int().positive(),
  channelCount: z.number().int().min(1).max(64),
  /** Last-set value per touched channel (this is a control surface; the desk
   *  holds the authoritative mix). */
  channels: z.array(ChannelStateSchema),
});
export type AudioConsoleConfig = z.infer<typeof AudioConsoleConfigSchema>;

export const AudioConsoleConfigListSchema = z.array(AudioConsoleConfigSchema);
export type AudioConsoleConfigList = z.infer<typeof AudioConsoleConfigListSchema>;

export type AudioConnectionState = 'connected' | 'connecting' | 'down';

export interface AudioStatus {
  id: string;
  state: AudioConnectionState;
  transport: AudioTransport;
  lastChecked: number;
  lastError?: string;
}

export const DEFAULT_CHANNEL_DB = 0;
