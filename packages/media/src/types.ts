// Generische, app-übergreifende Medien-Typen. Bewusst hier (statt im jeweiligen
// App-`@shared/types`), damit Media-Converter, Player, Recorder und Switcher
// dieselben Probe-/Encoder-Shapes teilen.

export interface MediaStreamInfo {
  type: 'video' | 'audio' | 'subtitle' | 'other';
  codec: string;
  width?: number;
  height?: number;
  fps?: number;
  channels?: number;
  sampleRate?: number;
}

export interface MediaInfo {
  path: string;
  fileName: string;
  durationSec: number;
  sizeBytes: number;
  format: string;
  streams: MediaStreamInfo[];
  video?: { codec: string; width: number; height: number; fps: number };
  audio?: { codec: string; channels: number; sampleRate: number };
}

export type HwKind = 'nvenc' | 'qsv' | 'videotoolbox' | 'vaapi';

export interface EncoderSupport {
  /** Hardware backend detected for the current machine, or null for software-only. */
  hwKind: HwKind | null;
  /** Raw set of ffmpeg encoder names available in the bundled binary. */
  available: string[];
}
