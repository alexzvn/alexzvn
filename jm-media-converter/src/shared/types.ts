export type JobKind = 'video' | 'office';
export type JobStatus = 'queued' | 'running' | 'done' | 'error' | 'canceled';

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

export type RateControl = 'quality' | 'vbr' | 'cbr';

export interface VideoConvertSpec {
  jobId: string;
  inputPath: string;
  outputDir: string;
  /** Base output name without extension; defaults to the input basename. */
  outputName?: string;
  presetId: string;
  /** Target height in px; null/undefined keeps original resolution. */
  scaleHeight?: number | null;
  rateControl: RateControl;
  /** CRF/CQ value for rateControl='quality'; null uses the preset default. */
  quality?: number | null;
  /** Target video bitrate (kbps) for rateControl='vbr'|'cbr'. */
  bitrateKbps?: number | null;
  /** Audio codec id ('aac','libmp3lame','ac3','alac','pcm_s16le','copy','none'). */
  audioCodec: string;
  /** Audio bitrate (kbps) for lossy audio codecs. */
  audioBitrateKbps?: number | null;
  useHardware: boolean;
  /** Source duration in seconds, used for progress calculation. */
  durationSec: number;
}

export interface PreviewRequest {
  inputPath: string;
  atSec: number;
  presetId: string;
  scaleHeight?: number | null;
  rateControl: RateControl;
  quality?: number | null;
  bitrateKbps?: number | null;
  useHardware: boolean;
  durationSec: number;
}

export interface PreviewResult {
  originalDataUrl: string;
  encodedDataUrl: string;
  /** Extrapolated full-length output size estimate in bytes (video stream). */
  estimatedBytes: number;
  segmentSec: number;
}

export interface OfficeConvertSpec {
  jobId: string;
  inputPath: string;
  outputDir: string;
}

export interface ConvertProgress {
  jobId: string;
  /** 0..100, or -1 when indeterminate (e.g. LibreOffice). */
  percent: number;
  fps?: number;
  speed?: string;
  etaSec?: number;
}

export interface ConvertResult {
  jobId: string;
  success: boolean;
  outputPath?: string;
  error?: string;
  canceled?: boolean;
}

export interface OfficeDetectResult {
  path: string | null;
}

/** Shape exposed on `window.jmc` by the preload bridge. */
export interface JmcApi {
  platform: NodeJS.Platform;
  pathForFile: (file: File) => string;
  dialog: {
    pickFiles: (kind: JobKind) => Promise<string[]>;
    pickDir: () => Promise<string | null>;
  };
  media: {
    probe: (path: string) => Promise<MediaInfo>;
    previewFrame: (req: PreviewRequest) => Promise<PreviewResult>;
  };
  encoders: {
    get: () => Promise<EncoderSupport>;
  };
  video: {
    enqueue: (spec: VideoConvertSpec) => Promise<void>;
    cancel: (jobId: string) => Promise<void>;
  };
  office: {
    detect: () => Promise<OfficeDetectResult>;
    enqueue: (spec: OfficeConvertSpec) => Promise<void>;
  };
  shell: {
    reveal: (path: string) => Promise<void>;
    openExternal: (url: string) => Promise<void>;
  };
  onProgress: (cb: (p: ConvertProgress) => void) => () => void;
  onDone: (cb: (r: ConvertResult) => void) => () => void;
}
