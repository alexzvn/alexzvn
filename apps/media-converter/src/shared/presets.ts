import type { HwKind } from './types';

export type Container = 'mp4' | 'mov' | 'mkv';
export type QualityKind = 'crf' | 'none';

export interface VideoPreset {
  id: string;
  label: string;
  description: string;
  container: Container;
  /** Software encoder (always available, used as fallback). */
  swEncoder: string;
  /** Hardware encoder name per backend, when the preset supports it. */
  hwEncoder?: Partial<Record<HwKind, string>>;
  /** Audio: ffmpeg codec name, or 'copy' to passthrough. */
  audioCodec: string;
  audioBitrateKbps?: number;
  qualityKind: QualityKind;
  /** Default quality on a CRF-like scale (lower = better). */
  defaultQuality?: number;
  qualityRange?: [number, number];
  /** Fixed extra args appended verbatim (e.g. ProRes profile). */
  extraArgs?: string[];
}

export const VIDEO_PRESETS: VideoPreset[] = [
  {
    id: 'h264-mp4',
    label: 'H.264 · MP4',
    description: 'Universell kompatibel, gut für Web & Wiedergabe.',
    container: 'mp4',
    swEncoder: 'libx264',
    hwEncoder: {
      nvenc: 'h264_nvenc',
      qsv: 'h264_qsv',
      videotoolbox: 'h264_videotoolbox',
      vaapi: 'h264_vaapi',
    },
    audioCodec: 'aac',
    audioBitrateKbps: 192,
    qualityKind: 'crf',
    defaultQuality: 20,
    qualityRange: [14, 30],
    extraArgs: ['-movflags', '+faststart', '-pix_fmt', 'yuv420p'],
  },
  {
    id: 'hevc-mp4',
    label: 'H.265 (HEVC) · MP4',
    description: 'Kleinere Dateien bei gleicher Qualität, ideal für 4K.',
    container: 'mp4',
    swEncoder: 'libx265',
    hwEncoder: {
      nvenc: 'hevc_nvenc',
      qsv: 'hevc_qsv',
      videotoolbox: 'hevc_videotoolbox',
      vaapi: 'hevc_vaapi',
    },
    audioCodec: 'aac',
    audioBitrateKbps: 192,
    qualityKind: 'crf',
    defaultQuality: 24,
    qualityRange: [18, 32],
    extraArgs: ['-movflags', '+faststart', '-tag:v', 'hvc1', '-pix_fmt', 'yuv420p'],
  },
  {
    id: 'av1-mp4',
    label: 'AV1 · MP4',
    description: 'Moderne, hocheffiziente Codierung (langsamer in Software).',
    container: 'mp4',
    swEncoder: 'libsvtav1',
    hwEncoder: {
      nvenc: 'av1_nvenc',
      qsv: 'av1_qsv',
    },
    audioCodec: 'aac',
    audioBitrateKbps: 192,
    qualityKind: 'crf',
    defaultQuality: 30,
    qualityRange: [20, 50],
    extraArgs: ['-movflags', '+faststart', '-pix_fmt', 'yuv420p'],
  },
  {
    id: 'prores-mov',
    label: 'ProRes 422 HQ · MOV',
    description: 'Schnitt-/Mastering-Format mit hoher Qualität (große Dateien).',
    container: 'mov',
    swEncoder: 'prores_ks',
    audioCodec: 'pcm_s16le',
    qualityKind: 'none',
    extraArgs: ['-profile:v', '3', '-pix_fmt', 'yuv422p10le'],
  },
  {
    id: 'dnxhr-mov',
    label: 'DNxHR HQ · MOV',
    description: 'Avid-/Schnitt-Format, plattformneutral.',
    container: 'mov',
    swEncoder: 'dnxhd',
    audioCodec: 'pcm_s16le',
    qualityKind: 'none',
    extraArgs: ['-profile:v', 'dnxhr_hq', '-pix_fmt', 'yuv422p'],
  },
];

export function getPreset(id: string): VideoPreset | undefined {
  return VIDEO_PRESETS.find((p) => p.id === id);
}

export const SCALE_OPTIONS: { label: string; value: number | null }[] = [
  { label: 'Original', value: null },
  { label: '2160p (4K)', value: 2160 },
  { label: '1440p', value: 1440 },
  { label: '1080p', value: 1080 },
  { label: '720p', value: 720 },
  { label: '480p', value: 480 },
];

export interface AudioCodecOption {
  id: string;
  label: string;
  lossless?: boolean;
}

export const AUDIO_CODECS: AudioCodecOption[] = [
  { id: 'aac', label: 'AAC' },
  { id: 'libmp3lame', label: 'MP3' },
  { id: 'ac3', label: 'AC-3 (Dolby Digital)' },
  { id: 'alac', label: 'ALAC (verlustfrei)', lossless: true },
  { id: 'pcm_s16le', label: 'PCM / WAV (verlustfrei)', lossless: true },
  { id: 'copy', label: 'Originalspur übernehmen' },
  { id: 'none', label: 'Kein Ton' },
];

export const AUDIO_BITRATES = [96, 128, 160, 192, 256, 320];

export function audioCodecOption(id: string): AudioCodecOption | undefined {
  return AUDIO_CODECS.find((c) => c.id === id);
}

/** Audio codecs that mux cleanly into the preset's container. */
export function audioCodecsForContainer(container: Container): string[] {
  if (container === 'mov') return ['aac', 'pcm_s16le', 'alac', 'copy', 'none'];
  if (container === 'mkv') return ['aac', 'libmp3lame', 'ac3', 'alac', 'pcm_s16le', 'copy', 'none'];
  return ['aac', 'libmp3lame', 'ac3', 'alac', 'copy', 'none']; // mp4
}

export function isLosslessAudio(id: string): boolean {
  return Boolean(audioCodecOption(id)?.lossless);
}

export function usesAudioBitrate(id: string): boolean {
  return id !== 'none' && id !== 'copy' && !isLosslessAudio(id);
}

/** A sensible default video bitrate (kbps) for VBR/CBR by target height. */
export function defaultBitrateKbps(height: number | null): number {
  if (!height) return 8000;
  if (height >= 2160) return 35000;
  if (height >= 1440) return 16000;
  if (height >= 1080) return 8000;
  if (height >= 720) return 5000;
  return 2500;
}
