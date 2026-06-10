// --- JM Transcribe: lokale Untertitel/Transkripte via whisper.cpp ---
//
// Pipeline je Datei (Main): ffmpeg → 16-kHz-Mono-WAV → whisper.cpp → SRT/VTT/TXT.
// whisper-Binary + Basismodell sind gebündelt (resources), größere Modelle
// lädt der Nutzer bei Bedarf nach (userData/models).

export type WhisperModelId = 'tiny' | 'base' | 'small' | 'medium' | 'large-v3';

export interface ModelInfo {
  id: WhisperModelId;
  label: string;
  /** Ungefähre Dateigröße in MB (für Anzeige/Download). */
  sizeMB: number;
  /** Mit dem Installer mitgeliefert (offline sofort verfügbar). */
  bundled: boolean;
}

/** Bekannte Modelle (ggml). `base` ist gebündelt, der Rest nachladbar. */
export const MODELS: ModelInfo[] = [
  { id: 'tiny', label: 'Tiny (schnell, grob)', sizeMB: 75, bundled: false },
  { id: 'base', label: 'Base (mitgeliefert)', sizeMB: 142, bundled: true },
  { id: 'small', label: 'Small (gut)', sizeMB: 466, bundled: false },
  { id: 'medium', label: 'Medium (sehr gut)', sizeMB: 1500, bundled: false },
  { id: 'large-v3', label: 'Large v3 (beste Qualität)', sizeMB: 2900, bundled: false },
];

export interface ModelState extends ModelInfo {
  installed: boolean;
  /** Download-Fortschritt 0..1, wenn gerade geladen wird. */
  downloading: number | null;
}

export type Language =
  | 'auto'
  | 'de'
  | 'en'
  | 'fr'
  | 'es'
  | 'it'
  | 'nl'
  | 'pl'
  | 'pt'
  | 'ru'
  | 'tr';

export const LANGUAGES: { id: Language; label: string }[] = [
  { id: 'auto', label: 'Automatisch erkennen' },
  { id: 'de', label: 'Deutsch' },
  { id: 'en', label: 'Englisch' },
  { id: 'fr', label: 'Französisch' },
  { id: 'es', label: 'Spanisch' },
  { id: 'it', label: 'Italienisch' },
  { id: 'nl', label: 'Niederländisch' },
  { id: 'pl', label: 'Polnisch' },
  { id: 'pt', label: 'Portugiesisch' },
  { id: 'ru', label: 'Russisch' },
  { id: 'tr', label: 'Türkisch' },
];

export type OutputFormat = 'srt' | 'vtt' | 'txt';

export interface TranscribeConfig {
  model: WhisperModelId;
  language: Language;
  /** transcribe = Originalsprache, translate = nach Englisch übersetzen. */
  task: 'transcribe' | 'translate';
  formats: OutputFormat[];
  /** Zielordner (null = neben der Quelldatei). */
  outputDir: string | null;
}

export const DEFAULT_CONFIG: TranscribeConfig = {
  model: 'base',
  language: 'de',
  task: 'transcribe',
  formats: ['srt'],
  outputDir: null,
};

export type JobStatus =
  | 'queued'
  | 'preparing'
  | 'transcribing'
  | 'done'
  | 'error'
  | 'canceled';

export interface Job {
  id: string;
  filePath: string;
  fileName: string;
  status: JobStatus;
  /** 0..1 (während 'transcribing'). */
  progress: number;
  /** Erzeugte Ausgabedateien (absolute Pfade). */
  outputs: string[];
  error?: string;
}

export interface TranscribeState {
  config: TranscribeConfig;
  jobs: Job[];
  models: ModelState[];
  /** whisper-Binary vorhanden (sonst: auf Windows bauen). */
  engineReady: boolean;
}

export interface PartialTranscribeConfig {
  model?: WhisperModelId;
  language?: Language;
  task?: 'transcribe' | 'translate';
  formats?: OutputFormat[];
  outputDir?: string | null;
}

/** Shape, die der Preload auf `window.jmtranscribe` legt. */
export interface JmtranscribeApi {
  platform: NodeJS.Platform;
  getState: () => Promise<TranscribeState>;
  setConfig: (patch: PartialTranscribeConfig) => Promise<TranscribeState>;
  onState: (cb: (s: TranscribeState) => void) => () => void;
  /** Dateien per Dialog hinzufügen (liefert Anzahl neu hinzugefügter). */
  addFiles: () => Promise<number>;
  /** Dateipfade direkt hinzufügen (Drag & Drop). */
  addPaths: (paths: string[]) => Promise<number>;
  /** Absoluten Pfad einer gedroppten Datei ermitteln (Electron webUtils). */
  pathForFile: (file: File) => string;
  removeJob: (id: string) => Promise<void>;
  clearFinished: () => Promise<void>;
  start: () => Promise<void>;
  cancel: (id: string) => Promise<void>;
  chooseOutputDir: () => Promise<string | null>;
  revealOutput: (path: string) => Promise<void>;
  downloadModel: (id: WhisperModelId) => Promise<void>;
  deleteModel: (id: WhisperModelId) => Promise<void>;
}
