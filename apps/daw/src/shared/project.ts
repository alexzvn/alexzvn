// Projekt-/Timeline-Datenmodell für JM DAW (Mehrspur-Audio).
//
// Zeiten konsequent in MIKROSEKUNDEN (Integer) → kein Float-Drift,
// sampleratenunabhängig. Geforkt aus @jm/editor (gleiches µs-Modell), aber
// audiozentriert. Das Schema trägt bereits Felder für spätere Slices (Effekte,
// AUX-Busse/Sends), damit man erweitert statt umschreibt.
import type { MediaInfo } from '@jm/media';

export const PROJECT_FILE_VERSION = 1;
export const PROJECT_FILE_EXT = 'jmdaw';

/** Arbeitsrate der Engine (Web Audio + Offline-Render + WAV-Export). */
export const DEFAULT_SAMPLE_RATE = 48_000;

export const US_PER_SEC = 1_000_000;
export const usToSec = (us: number): number => us / US_PER_SEC;
export const secToUs = (sec: number): number => Math.round(sec * US_PER_SEC);

export type ProxyState = 'none' | 'building' | 'ready' | 'failed';

/** Eine importierte Audioquelle (geteilt von mehreren Clips). */
export interface MediaAsset {
  id: string;
  path: string;
  fileName: string;
  durationUs: number;
  /** Aus ffprobe (informativ; die Engine dekodiert auf DEFAULT_SAMPLE_RATE). */
  sampleRate?: number;
  channels?: number;
  hasAudio: boolean;
  /** Roh-Probe (ffprobe) — informativ / für spätere Slices. */
  probe?: MediaInfo;
  /**
   * Quelle ist nicht direkt vom Browser dekodierbar (decodeAudioData scheitert,
   * z. B. exotische Container) → der Main transkodiert nach 48-kHz-Float-WAV.
   */
  needsTranscode?: boolean;
  /** Pfad des dekodierbaren Proxy-WAV (falls transkodiert). */
  proxyPath?: string;
  proxyState?: ProxyState;
}

/** Platzhalter fürs spätere Effekt-Parametermodell (Slice 4). */
export interface EffectInstance {
  id: string;
  kind: string;
  params: Record<string, number | string>;
}

/** Ein- und Ausblende-Längen eines Clips (µs, von der jeweiligen Kante). */
export interface ClipFade {
  inUs: number;
  outUs: number;
}

export interface Clip {
  id: string;
  /** Quelle (MediaAsset.id). */
  assetId: string;
  /** Quell-In/Out innerhalb des Assets (µs). */
  inUs: number;
  outUs: number;
  /** Startposition auf der Spur-Timeline (µs). */
  startUs: number;
  /** Lineare Clip-Verstärkung (1 = unverändert). */
  gain: number;
  /** Ein-/Ausblende (Slice 1: per Inspector; Slice 2: Drag-Handles). */
  fade?: ClipFade;
  /** Reserviert für Clip-Effekte (Slice 4). */
  effects?: EffectInstance[];
  enabled: boolean;
}

/** 'audio' = normale Spur; 'bus' reserviert für AUX-Busse (Slice 3). */
export type TrackKind = 'audio' | 'bus';

export interface TrackSend {
  busId: string;
  /** Send-Pegel in dB. */
  gainDb: number;
}

export interface Track {
  id: string;
  kind: TrackKind;
  name: string;
  /** Nach startUs sortiert; auf einer Spur überlappungsfrei. */
  clips: Clip[];
  /** Linearer Spur-Fader (1 = 0 dB). */
  gain: number;
  /** Panorama -1 (links) .. +1 (rechts). */
  pan: number;
  muted: boolean;
  solo: boolean;
  locked: boolean;
  /** Reserviert für AUX-Sends (Slice 3). */
  sends?: TrackSend[];
  /** Reserviert für Bus-Routing (Slice 3); null/undefined = Master. */
  outputBusId?: string | null;
}

export interface MasterSettings {
  /** Linearer Master-Fader. */
  gain: number;
  /** Reserviert für Master-Chain (Slice 4). */
  effects?: EffectInstance[];
}

export type AudioExportFormat = 'wav' | 'mp3' | 'flac' | 'aac' | 'ogg';

export interface AudioExportSettings {
  format: AudioExportFormat;
  sampleRate: number;
  /** Nur WAV. */
  bitDepth?: 16 | 24 | 32;
  /** Nur verlustbehaftet (mp3/aac/ogg). */
  bitrateKbps?: number | null;
}

export interface Project {
  version: number;
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  assets: MediaAsset[];
  tracks: Track[];
  master: MasterSettings;
  export: AudioExportSettings;
  /** Arbeits-Samplerate des Projekts. */
  sampleRate: number;
}

let idSeq = 0;
/** Kollisionsarme ID (Zeit + Zähler + Zufall) — reicht für Clip/Track/Asset-IDs. */
export function newId(prefix = 'id'): string {
  idSeq = (idSeq + 1) % 1_000_000;
  return `${prefix}_${Date.now().toString(36)}_${idSeq.toString(36)}_${Math.floor(
    Math.random() * 1e6,
  ).toString(36)}`;
}

export const DEFAULT_EXPORT: AudioExportSettings = {
  format: 'wav',
  sampleRate: DEFAULT_SAMPLE_RATE,
  bitDepth: 24,
  bitrateKbps: 256,
};

export function makeAudioTrack(name: string): Track {
  return {
    id: newId('trk'),
    kind: 'audio',
    name,
    clips: [],
    gain: 1,
    pan: 0,
    muted: false,
    solo: false,
    locked: false,
  };
}

export function makeEmptyProject(name = 'Unbenanntes Projekt'): Project {
  const now = Date.now();
  return {
    version: PROJECT_FILE_VERSION,
    id: newId('proj'),
    name,
    createdAt: now,
    updatedAt: now,
    assets: [],
    tracks: [makeAudioTrack('Spur 1'), makeAudioTrack('Spur 2')],
    master: { gain: 1 },
    export: { ...DEFAULT_EXPORT },
    sampleRate: DEFAULT_SAMPLE_RATE,
  };
}

/** Migriert ältere Projektdateien auf das aktuelle Schema (idempotent). */
export function migrateProject(raw: unknown): Project {
  const p = raw as Partial<Project>;
  if (!p || typeof p !== 'object') throw new Error('Ungültige Projektdatei.');
  const base = makeEmptyProject(p.name ?? 'Projekt');
  return {
    ...base,
    ...p,
    version: PROJECT_FILE_VERSION,
    master: { ...base.master, ...(p.master ?? {}) },
    export: { ...DEFAULT_EXPORT, ...(p.export ?? {}) },
    assets: p.assets ?? [],
    tracks: (p.tracks ?? base.tracks).map(normalizeTrack),
    sampleRate: p.sampleRate ?? base.sampleRate,
  } as Project;
}

/** Ältere/teilweise Track-Objekte mit Defaults auffüllen. */
function normalizeTrack(t: Partial<Track>): Track {
  return {
    id: t.id ?? newId('trk'),
    kind: t.kind ?? 'audio',
    name: t.name ?? 'Spur',
    clips: (t.clips ?? []).map(normalizeClip),
    gain: t.gain ?? 1,
    pan: t.pan ?? 0,
    muted: t.muted ?? false,
    solo: t.solo ?? false,
    locked: t.locked ?? false,
    sends: t.sends,
    outputBusId: t.outputBusId ?? null,
  };
}

function normalizeClip(c: Partial<Clip>): Clip {
  return {
    id: c.id ?? newId('clip'),
    assetId: c.assetId ?? '',
    inUs: c.inUs ?? 0,
    outUs: c.outUs ?? 0,
    startUs: c.startUs ?? 0,
    gain: c.gain ?? 1,
    fade: c.fade,
    effects: c.effects,
    enabled: c.enabled ?? true,
  };
}

// ── Abgeleitete Werte ───────────────────────────────────────────────────────

export const clipDurationUs = (clip: Clip): number => Math.max(0, clip.outUs - clip.inUs);
export const clipEndUs = (clip: Clip): number => clip.startUs + clipDurationUs(clip);

export function trackEndUs(track: Track): number {
  return track.clips.reduce((max, c) => Math.max(max, clipEndUs(c)), 0);
}

export function projectDurationUs(project: Project): number {
  return project.tracks.reduce((max, t) => Math.max(max, trackEndUs(t)), 0);
}

export function findAsset(project: Project, assetId: string | undefined): MediaAsset | undefined {
  if (!assetId) return undefined;
  return project.assets.find((a) => a.id === assetId);
}

/** Clips einer Spur nach Startzeit sortiert (neue Liste). */
export function sortedClips(track: Track): Clip[] {
  return [...track.clips].sort((a, b) => a.startUs - b.startUs);
}

/** Der Clip einer Spur, der den Zeitpunkt t (µs) überdeckt (oder undefined). */
export function clipAt(track: Track, tUs: number): Clip | undefined {
  return track.clips.find((c) => tUs >= c.startUs && tUs < clipEndUs(c));
}

/** Ob irgendeine Spur solo-geschaltet ist (Solo blendet alle anderen aus). */
export function anySolo(project: Project): boolean {
  return project.tracks.some((t) => t.solo);
}

/** Effektive lineare Spurverstärkung unter Berücksichtigung von Mute/Solo. */
export function effectiveTrackGain(project: Project, track: Track): number {
  if (track.muted) return 0;
  if (anySolo(project) && !track.solo) return 0;
  return track.gain;
}

/** dB ↔ linear (für Fader-Anzeige). */
export const dbToGain = (db: number): number => (db <= -60 ? 0 : Math.pow(10, db / 20));
export const gainToDb = (g: number): number => (g <= 0 ? -Infinity : 20 * Math.log10(g));
