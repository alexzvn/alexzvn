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
