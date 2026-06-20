import { z } from 'zod';

// The TriCaster LiveControl HTTP/Shortcut API is served on the standard
// HTTP port (80) — e.g. http://<tricaster-ip>/v1/shortcut?name=...
export const DEFAULT_TRICASTER_PORT = 80;

export const TricasterConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  host: z.string().min(1),
  port: z.number().int().positive(),
});
export type TricasterConfig = z.infer<typeof TricasterConfigSchema>;

export const TricasterConfigListSchema = z.array(TricasterConfigSchema);
export type TricasterConfigList = z.infer<typeof TricasterConfigListSchema>;

export type TricasterConnectionState = 'connected' | 'polling' | 'down';

export interface TricasterStatus {
  id: string;
  state: TricasterConnectionState;
  version?: string;
  lastChecked: number;
  lastError?: string;
}

export type MacroCategory =
  | 'Switcher'
  | 'DSK'
  | 'DDR'
  | 'Record'
  | 'Stream'
  | 'M/E'
  | 'Buffers'
  | 'Audio'
  | 'User Macros';

export interface MacroEntry {
  id: string;
  category: MacroCategory;
  label: string;
  shortcut: string;
  description?: string;
}

// Number of DSKs and DDRs available on the TriCaster TC2 Elite (4 each).
export const DSK_COUNT = 4;
export const DDR_COUNT = 4;

export interface DskEntry {
  index: number;        // 1..DSK_COUNT
  label: string;        // "DSK 1"
  /** Animierter Toggle (mit Übergang). */
  autoShortcut: string;
  /** Harter Schnitt-Toggle. */
  takeShortcut: string;
}

// TriCaster-DSKs sind ein Toggle, kein getrenntes On/Off: `main_dskN_auto`
// blendet animiert ein/aus, `main_dskN_take` schneidet hart (Issue #34 — die
// frühere `..._on/_off`-Schreibweise existiert in der Shortcut-API nicht).
export const DSK_ENTRIES: DskEntry[] = Array.from({ length: DSK_COUNT }, (_, i) => {
  const idx = i + 1;
  return {
    index: idx,
    label: `DSK ${idx}`,
    autoShortcut: `main_dsk${idx}_auto`,
    takeShortcut: `main_dsk${idx}_take`,
  };
});

export type DdrTransport = 'play' | 'pause' | 'stop' | 'next' | 'prev';

export interface DdrEntry {
  index: number;        // 1..DDR_COUNT
  label: string;        // "DDR 1"
  shortcuts: Record<DdrTransport, string>;
}

export const DDR_ENTRIES: DdrEntry[] = Array.from({ length: DDR_COUNT }, (_, i) => {
  const idx = i + 1;
  return {
    index: idx,
    label: `DDR ${idx}`,
    shortcuts: {
      play: `ddr_${idx}_play`,
      pause: `ddr_${idx}_pause`,
      stop: `ddr_${idx}_stop`,
      next: `ddr_${idx}_select_next`,
      prev: `ddr_${idx}_select_previous`,
    },
  };
});

// Static catalog seeded from "Full list of NewTek TriCaster Macros". This is
// a useful subset for the MVP — the full list can be added later. Names follow
// the LiveControl HTTP/Shortcut API conventions (case-sensitive).
export const MACRO_CATALOG: MacroEntry[] = [
  // Switcher
  { id: 'sw-take', category: 'Switcher', label: 'Take', shortcut: 'main_take' },
  { id: 'sw-auto', category: 'Switcher', label: 'Auto', shortcut: 'main_auto' },
  { id: 'sw-fade', category: 'Switcher', label: 'Fade to Black', shortcut: 'main_fade_to_black' },

  // DSKs 1-4 (also exposed via the dedicated DSK panel — kept here as a
  // fallback / quick search reference)
  ...DSK_ENTRIES.flatMap((d) => [
    { id: `dsk${d.index}-auto`, category: 'DSK' as const, label: `${d.label} Auto`, shortcut: d.autoShortcut },
    { id: `dsk${d.index}-take`, category: 'DSK' as const, label: `${d.label} Take`, shortcut: d.takeShortcut },
  ]),

  // DDRs 1-4 (also exposed via the dedicated DDR panel)
  ...DDR_ENTRIES.flatMap((d) => [
    { id: `ddr${d.index}-play`, category: 'DDR' as const, label: `${d.label} · Play`, shortcut: d.shortcuts.play },
    { id: `ddr${d.index}-pause`, category: 'DDR' as const, label: `${d.label} · Pause`, shortcut: d.shortcuts.pause },
    { id: `ddr${d.index}-stop`, category: 'DDR' as const, label: `${d.label} · Stop`, shortcut: d.shortcuts.stop },
  ]),

  // Record / Stream
  { id: 'rec-start', category: 'Record', label: 'Record · Start', shortcut: 'record_toggle_start' },
  { id: 'rec-stop', category: 'Record', label: 'Record · Stop', shortcut: 'record_toggle_stop' },
  { id: 'stream-start', category: 'Stream', label: 'Stream · Start', shortcut: 'streaming_toggle_start' },
  { id: 'stream-stop', category: 'Stream', label: 'Stream · Stop', shortcut: 'streaming_toggle_stop' },

  // M/E
  { id: 'me1-take', category: 'M/E', label: 'M/E 1 Take', shortcut: 'me_a_take' },
  { id: 'me1-auto', category: 'M/E', label: 'M/E 1 Auto', shortcut: 'me_a_auto' },
  { id: 'me2-take', category: 'M/E', label: 'M/E 2 Take', shortcut: 'me_b_take' },
  { id: 'me2-auto', category: 'M/E', label: 'M/E 2 Auto', shortcut: 'me_b_auto' },

  // Buffers
  { id: 'buf-prev', category: 'Buffers', label: 'Buffer · Previous', shortcut: 'buffers_select_previous' },
  { id: 'buf-next', category: 'Buffers', label: 'Buffer · Next', shortcut: 'buffers_select_next' },

  // Audio
  { id: 'aud-mute-main', category: 'Audio', label: 'Mute · Master', shortcut: 'audio_mixer_main_mute_toggle' },
];
