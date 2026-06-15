// Export-Presets für JM Editor. Übernommen aus JM Media Converter (gleiche
// Encoder-/Rate-Logik), reduziert auf die für den Schnitt relevanten Ziele.
import type { HwKind } from '@jm/media';

export type Container = 'mp4' | 'mov' | 'mkv';
export type QualityKind = 'crf' | 'none';

export interface VideoPreset {
  id: string;
  label: string;
  description: string;
  container: Container;
  /** Software-Encoder (immer verfügbar, Fallback). */
  swEncoder: string;
  /** Hardware-Encoder je Backend, wenn das Preset es unterstützt. */
  hwEncoder?: Partial<Record<HwKind, string>>;
  qualityKind: QualityKind;
  /** Default-Qualität auf CRF-artiger Skala (niedriger = besser). */
  defaultQuality?: number;
  qualityRange?: [number, number];
  /** Fixe Zusatzargumente (z. B. ProRes-Profil), wörtlich angehängt. */
  extraArgs?: string[];
}

export const VIDEO_PRESETS: VideoPreset[] = [
  {
    id: 'h264-mp4',
    label: 'H.264 · MP4',
    description: 'Universell kompatibel, gut für Web & Wiedergabe.',
    container: 'mp4',
    swEncoder: 'libx264',
    hwEncoder: { nvenc: 'h264_nvenc', qsv: 'h264_qsv', videotoolbox: 'h264_videotoolbox', vaapi: 'h264_vaapi' },
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
    hwEncoder: { nvenc: 'hevc_nvenc', qsv: 'hevc_qsv', videotoolbox: 'hevc_videotoolbox', vaapi: 'hevc_vaapi' },
    qualityKind: 'crf',
    defaultQuality: 24,
    qualityRange: [18, 32],
    extraArgs: ['-movflags', '+faststart', '-tag:v', 'hvc1', '-pix_fmt', 'yuv420p'],
  },
  {
    id: 'prores-mov',
    label: 'ProRes 422 HQ · MOV',
    description: 'Schnitt-/Mastering-Format mit hoher Qualität (große Dateien).',
    container: 'mov',
    swEncoder: 'prores_ks',
    qualityKind: 'none',
    extraArgs: ['-profile:v', '3', '-pix_fmt', 'yuv422p10le'],
  },
  {
    id: 'dnxhr-mov',
    label: 'DNxHR HQ · MOV',
    description: 'Avid-/Schnitt-Format, plattformneutral.',
    container: 'mov',
    swEncoder: 'dnxhd',
    qualityKind: 'none',
    extraArgs: ['-profile:v', 'dnxhr_hq', '-pix_fmt', 'yuv422p'],
  },
];

export function getPreset(id: string): VideoPreset | undefined {
  return VIDEO_PRESETS.find((p) => p.id === id);
}

/** Audio-Codec, der sauber in den Container des Presets muxt. */
export function audioCodecForContainer(container: Container, requested: string): string {
  if (container === 'mov' && requested === 'libmp3lame') return 'aac';
  return requested;
}

export const SEQUENCE_PRESETS: { label: string; width: number; height: number; fps: number }[] = [
  { label: '1080p · 25 (PAL)', width: 1920, height: 1080, fps: 25 },
  { label: '1080p · 30', width: 1920, height: 1080, fps: 30 },
  { label: '1080p · 50', width: 1920, height: 1080, fps: 50 },
  { label: '2160p (4K) · 25', width: 3840, height: 2160, fps: 25 },
  { label: '2160p (4K) · 30', width: 3840, height: 2160, fps: 30 },
  { label: '720p · 30', width: 1280, height: 720, fps: 30 },
];

export const AUDIO_CODECS: { id: string; label: string }[] = [
  { id: 'aac', label: 'AAC' },
  { id: 'pcm_s16le', label: 'PCM / WAV (verlustfrei)' },
  { id: 'none', label: 'Kein Ton' },
];

export function usesAudioBitrate(id: string): boolean {
  return id === 'aac';
}
