import { z } from 'zod';

export const DEFAULT_TRICASTER_PORT = 5951;

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

// Static catalog seeded from "Full list of NewTek TriCaster Macros". This is
// a useful subset for the MVP — the full list can be added later. Names follow
// the LiveControl HTTP/Shortcut API conventions (case-sensitive).
export const MACRO_CATALOG: MacroEntry[] = [
  // Switcher
  { id: 'sw-take', category: 'Switcher', label: 'Take', shortcut: 'main_take' },
  { id: 'sw-auto', category: 'Switcher', label: 'Auto', shortcut: 'main_auto' },
  { id: 'sw-fade', category: 'Switcher', label: 'Fade to Black', shortcut: 'main_fade_to_black' },

  // DSK
  { id: 'dsk1-on', category: 'DSK', label: 'DSK 1 On', shortcut: 'dsk_1_take_on' },
  { id: 'dsk1-off', category: 'DSK', label: 'DSK 1 Off', shortcut: 'dsk_1_take_off' },
  { id: 'dsk2-on', category: 'DSK', label: 'DSK 2 On', shortcut: 'dsk_2_take_on' },
  { id: 'dsk2-off', category: 'DSK', label: 'DSK 2 Off', shortcut: 'dsk_2_take_off' },

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
