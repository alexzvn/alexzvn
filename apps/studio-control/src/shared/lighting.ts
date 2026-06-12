import { z } from 'zod';

// Art-Net DMX output for the studio lighting rig. The transport (Art-Net over
// UDP 6454 to a Eurolite Node IV) is exact and fully verifiable. The per-fixture
// DMX *channel maps* below are sensible defaults from Aputure's DMX charts but
// depend on the profile/firmware selected on the fixture — they are data, not
// code, so a wrong map is a one-field patch fix and must be checked against the
// real fixture's DMX menu.
export const ARTNET_PORT = 6454;
export const DMX_UNIVERSE_SIZE = 512;
export const DEFAULT_ARTNET_FPS = 40;

export type ControlKind = 'intensity' | 'cct' | 'rgb';

export interface FixtureProfile {
  id: string;
  name: string;
  /** DMX channels this profile occupies. */
  footprint: number;
  /** Which high-level controls the UI should show. */
  controls: ControlKind[];
  /** Kelvin range for the CCT control, if any. */
  cctRange?: [number, number];
}

export const FIXTURE_PROFILES: FixtureProfile[] = [
  { id: 'aputure-ls60x', name: 'Aputure LS 60X', footprint: 2, controls: ['intensity', 'cct'], cctRange: [2700, 6500] },
  { id: 'aputure-ls300x', name: 'Aputure LS 300X', footprint: 2, controls: ['intensity', 'cct'], cctRange: [2700, 6500] },
  { id: 'aputure-nova-p300c-cct', name: 'Aputure Nova P300C · CCT', footprint: 2, controls: ['intensity', 'cct'], cctRange: [2000, 10000] },
  { id: 'aputure-nova-p300c-rgb', name: 'Aputure Nova P300C · RGB', footprint: 4, controls: ['intensity', 'rgb'] },
  { id: 'generic-dimmer', name: 'Dimmer (1 Kanal)', footprint: 1, controls: ['intensity'] },
  { id: 'generic-rgb', name: 'RGB (3 Kanäle)', footprint: 3, controls: ['intensity', 'rgb'] },
];

export function findProfile(id: string): FixtureProfile | undefined {
  return FIXTURE_PROFILES.find((p) => p.id === id);
}

export const FixtureStateSchema = z.object({
  on: z.boolean(),
  /** Master intensity in percent. */
  intensity: z.number().min(0).max(100),
  /** Colour temperature in Kelvin (used when the profile supports CCT). */
  cct: z.number().min(1000).max(20000),
  r: z.number().int().min(0).max(255),
  g: z.number().int().min(0).max(255),
  b: z.number().int().min(0).max(255),
});
export type FixtureState = z.infer<typeof FixtureStateSchema>;

export const DEFAULT_FIXTURE_STATE: FixtureState = {
  on: true,
  intensity: 0,
  cct: 5600,
  r: 255,
  g: 255,
  b: 255,
};

export const FixtureSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  profileId: z.string().min(1),
  /** 15-bit Art-Net port address (0–32767). */
  universe: z.number().int().min(0).max(32767),
  /** 1-based DMX start channel (1–512). */
  address: z.number().int().min(1).max(DMX_UNIVERSE_SIZE),
  state: FixtureStateSchema,
});
export type Fixture = z.infer<typeof FixtureSchema>;

export const ArtnetNodeSchema = z.object({
  host: z.string().min(1),
  fps: z.number().int().min(1).max(60).optional(),
});
export type ArtnetNode = z.infer<typeof ArtnetNodeSchema>;

export const LightingConfigSchema = z.object({
  node: ArtnetNodeSchema.nullable(),
  fixtures: z.array(FixtureSchema),
});
export type LightingConfig = z.infer<typeof LightingConfigSchema>;

export const DEFAULT_LIGHTING_CONFIG: LightingConfig = { node: null, fixtures: [] };

/** Partial live update to a fixture's state (a fader move, a colour pick, …). */
export const FixtureStatePatchSchema = FixtureStateSchema.partial();
export type FixtureStatePatch = z.infer<typeof FixtureStatePatchSchema>;

// ===== Rendering: high-level state → DMX channel values =====

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function pct255(p: number): number {
  return clampByte((p / 100) * 255);
}

function cctByte(kelvin: number, range: [number, number]): number {
  const [lo, hi] = range;
  if (hi <= lo) return 0;
  return clampByte(((kelvin - lo) / (hi - lo)) * 255);
}

/**
 * Pure: a fixture's high-level state → its DMX channel values (length ==
 * footprint). Off → all zero. Used by the engine to compose the universe and
 * unit-tested directly.
 */
export function renderFixture(profileId: string, state: FixtureState): number[] {
  const profile = findProfile(profileId);
  if (!profile) return [];
  const out = new Array<number>(profile.footprint).fill(0);
  if (!state.on) return out;

  const hasDim = profile.controls.includes('intensity');
  const dim = hasDim ? state.intensity : 100;

  switch (profileId) {
    case 'aputure-ls60x':
    case 'aputure-ls300x':
    case 'aputure-nova-p300c-cct':
      out[0] = pct255(dim);
      out[1] = cctByte(state.cct, profile.cctRange ?? [2700, 6500]);
      break;
    case 'aputure-nova-p300c-rgb':
      // Master dimmer + raw R/G/B (the fixture does the dimming).
      out[0] = pct255(dim);
      out[1] = clampByte(state.r);
      out[2] = clampByte(state.g);
      out[3] = clampByte(state.b);
      break;
    case 'generic-rgb':
      // No master channel — dim in software so the intensity fader still works.
      out[0] = clampByte(state.r * (dim / 100));
      out[1] = clampByte(state.g * (dim / 100));
      out[2] = clampByte(state.b * (dim / 100));
      break;
    case 'generic-dimmer':
    default:
      out[0] = pct255(dim);
      break;
  }
  return out;
}
