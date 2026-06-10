/** Hash algorithms the engine can compute. xxHash64 is the primary, MD5 is optional. */
export type HashAlgo = 'xxhash64' | 'md5';

/** Lifecycle of a single file within a copy job. */
export type FileStatus =
  | 'pending'
  | 'copying'
  | 'verifying'
  | 'verified'
  | 'mismatch'
  | 'error'
  | 'canceled';

export interface SourceItem {
  /** Absolute path of the source file. */
  path: string;
  /** Path relative to the scanned source root — preserves sub-structure on the target. */
  relPath: string;
  sizeBytes: number;
}

export interface ScanResult {
  /** Common root the relPaths are relative to. */
  root: string;
  files: SourceItem[];
  totalBytes: number;
  /** Paths that could not be read (permission, vanished, …). */
  skipped: string[];
}

export interface Destination {
  id: string;
  /** Absolute base directory the user picked (the drive/volume). */
  basePath: string;
  /** Resolved Baukasten sub-path (already templated by the renderer). May be ''. */
  subPath: string;
  /** Fixed subfolders to pre-create inside the resolved master folder. */
  subfolders: string[];
}

export interface CopySpec {
  jobId: string;
  source: ScanResult;
  destinations: Destination[];
  /** Read each written file back and compare its hash against the source. */
  verify: boolean;
  /** Additionally compute MD5 next to xxHash64. */
  alsoMd5: boolean;
  /** Write an MHL sidecar into each destination master folder. */
  writeMhl: boolean;
}

/** Per-file event — drives the file list rows. */
export interface FileProgress {
  jobId: string;
  fileIndex: number;
  relPath: string;
  status: FileStatus;
  /** 0..1 progress for the current file (copy+verify combined). */
  fileFraction: number;
  error?: string;
}

/** Aggregate event — drives the global progress bar / speed / ETA. */
export interface JobProgress {
  jobId: string;
  bytesDone: number;
  bytesTotal: number;
  filesDone: number;
  filesTotal: number;
  bytesPerSec: number;
  etaSec: number;
  currentRelPath: string;
  phase: 'copy' | 'verify' | 'mhl';
}

export interface FileResult {
  relPath: string;
  sizeBytes: number;
  status: FileStatus;
  xxhash64?: string;
  md5?: string;
  error?: string;
}

export interface DestinationResult {
  basePath: string;
  /** Full absolute path of the resolved master folder. */
  folder: string;
  mhlPath?: string;
}

export interface JobResult {
  jobId: string;
  canceled: boolean;
  filesTotal: number;
  verified: number;
  failed: number;
  destinations: DestinationResult[];
  files: FileResult[];
  startedAtMs: number;
  finishedAtMs: number;
  durationMs: number;
  totalBytes: number;
}

/** Re-verification of an existing folder against its MHL sidecar. */
export type VerifyFileStatus = 'ok' | 'mismatch' | 'missing';

export interface VerifyFile {
  relPath: string;
  status: VerifyFileStatus;
  expected?: string;
  actual?: string;
  sizeBytes?: number;
}

export interface VerifyReport {
  mhlPath: string;
  root: string;
  total: number;
  ok: number;
  mismatch: number;
  missing: number;
  files: VerifyFile[];
}

export interface VerifyProgress {
  done: number;
  total: number;
  currentRelPath: string;
}

// ---- Netzwerk-Sync (Einweg-Spiegel: Quelle → Ziel(e)) ----

export interface SyncTarget {
  id: string;
  /** Zielordner — i. d. R. ein gemounteter Netzwerkpfad (UNC \\HOST\Share, Z:\…, /Volumes/…). */
  path: string;
}

export interface SyncRunSummary {
  at: number;
  copied: number;
  deleted: number;
  failed: number;
  bytes: number;
  durationMs: number;
  canceled?: boolean;
}

export interface SyncJob {
  id: string;
  name: string;
  /** Quellordner (maßgeblich). */
  sourcePath: string;
  targets: SyncTarget[];
  /** Spiegeln: am Ziel zusätzliche Dateien löschen. */
  mirror: boolean;
  /** Kopierte Dateien per Hash gegen die Quelle prüfen. */
  verify: boolean;
  createdAt: number;
  updatedAt: number;
  lastRun?: SyncRunSummary;
}

export type SyncAction = 'copy' | 'update' | 'delete';

export interface SyncPlanItem {
  relPath: string;
  action: SyncAction;
  /** Quelle: Dateigröße; Löschen: Größe am Ziel. */
  sizeBytes: number;
}

export interface SyncTargetPlan {
  targetId: string;
  targetPath: string;
  /** Ziel erreichbar (existiert/lesbar)? */
  reachable: boolean;
  copy: number;
  update: number;
  del: number;
  /** Zu kopierende/aktualisierende Bytes. */
  bytes: number;
  /** Auf eine Anzeige-Obergrenze gekürzte Liste. */
  items: SyncPlanItem[];
  error?: string;
}

export interface SyncPreview {
  jobId: string;
  sourceMissing: boolean;
  totalFiles: number;
  totalBytes: number;
  targets: SyncTargetPlan[];
}

export interface SyncProgress {
  jobId: string;
  phase: 'compare' | 'copy' | 'delete';
  targetPath: string;
  filesDone: number;
  filesTotal: number;
  bytesDone: number;
  bytesTotal: number;
  bytesPerSec: number;
  etaSec: number;
  currentRelPath: string;
}

export interface SyncTargetResult {
  targetId: string;
  targetPath: string;
  copied: number;
  deleted: number;
  failed: number;
  error?: string;
}

export interface SyncResult extends SyncRunSummary {
  jobId: string;
  targets: SyncTargetResult[];
}

/** Shape exposed on `window.jmcp` by the preload bridge. */
export interface JmcpApi {
  platform: NodeJS.Platform;
  pathForFile: (file: File) => string;
  dialog: {
    pickDir: (title?: string) => Promise<string | null>;
    pickFiles: () => Promise<string[]>;
  };
  scan: {
    /** Enumerate files under the given files/folders into a single ScanResult. */
    paths: (paths: string[]) => Promise<ScanResult>;
  };
  copy: {
    start: (spec: CopySpec) => Promise<void>;
    cancel: (jobId: string) => Promise<void>;
  };
  verify: {
    /** Find .mhl sidecars inside a folder (non-recursive at the chosen level). */
    findMhl: (dir: string) => Promise<string[]>;
    run: (mhlPath: string) => Promise<VerifyReport>;
  };
  sync: {
    listJobs: () => Promise<SyncJob[]>;
    /** Anlegen oder aktualisieren (Upsert anhand id). */
    saveJob: (job: SyncJob) => Promise<SyncJob>;
    removeJob: (id: string) => Promise<void>;
    /** Trockenlauf: was würde kopiert/gelöscht? */
    preview: (id: string) => Promise<SyncPreview>;
    run: (id: string) => Promise<void>;
    cancel: (id: string) => Promise<void>;
  };
  shell: {
    reveal: (path: string) => Promise<void>;
    openExternal: (url: string) => Promise<void>;
  };
  onFileProgress: (cb: (p: FileProgress) => void) => () => void;
  onJobProgress: (cb: (p: JobProgress) => void) => () => void;
  onDone: (cb: (r: JobResult) => void) => () => void;
  onVerifyProgress: (cb: (p: VerifyProgress) => void) => () => void;
  onSyncProgress: (cb: (p: SyncProgress) => void) => () => void;
  onSyncDone: (cb: (r: SyncResult) => void) => () => void;
}
