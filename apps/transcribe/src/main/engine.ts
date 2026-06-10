import { app } from 'electron';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { basename, extname, dirname, join } from 'node:path';
import { ffmpegPath } from '@jm/media';
import type { Job, OutputFormat, TranscribeConfig } from '@shared/types';
import { whisperPath } from './locate';
import { modelPathFor } from './models';

let jobs: Job[] = [];
let onChange: () => void = () => {};
let processing = false;
let current: ChildProcess | null = null;
let currentJobId: string | null = null;
const canceled = new Set<string>();
let seq = 0;

export function setOnChange(cb: () => void): void {
  onChange = cb;
}
export function getJobs(): Job[] {
  return jobs;
}

export function addJobs(paths: string[]): number {
  let added = 0;
  for (const p of paths) {
    if (jobs.some((j) => j.filePath === p && j.status !== 'done' && j.status !== 'error')) continue;
    jobs.push({
      id: `j${Date.now()}_${seq++}`,
      filePath: p,
      fileName: basename(p),
      status: 'queued',
      progress: 0,
      outputs: [],
    });
    added++;
  }
  if (added) onChange();
  return added;
}

export function removeJob(id: string): void {
  if (id === currentJobId) {
    cancel(id);
    return;
  }
  jobs = jobs.filter((j) => j.id !== id);
  onChange();
}

export function clearFinished(): void {
  jobs = jobs.filter((j) => j.status !== 'done' && j.status !== 'error' && j.status !== 'canceled');
  onChange();
}

export function cancel(id: string): void {
  const job = jobs.find((j) => j.id === id);
  if (!job) return;
  if (id === currentJobId && current) {
    canceled.add(id);
    current.kill();
  } else if (job.status === 'queued') {
    job.status = 'canceled';
    onChange();
  }
}

/** Verarbeitung der Warteschlange anstoßen (seriell). */
export function startQueue(getConfig: () => TranscribeConfig): void {
  if (processing) return;
  processing = true;
  void run(getConfig).finally(() => {
    processing = false;
  });
}

async function run(getConfig: () => TranscribeConfig): Promise<void> {
  for (;;) {
    const job = jobs.find((j) => j.status === 'queued');
    if (!job) break;
    await processJob(job, getConfig());
  }
}

async function processJob(job: Job, config: TranscribeConfig): Promise<void> {
  currentJobId = job.id;
  const wav = join(app.getPath('temp'), `jmtranscribe-${job.id}.wav`);

  const fail = (msg: string): void => {
    job.status = canceled.has(job.id) ? 'canceled' : 'error';
    if (!canceled.has(job.id)) job.error = msg;
    cleanup(wav);
    onChange();
  };

  try {
    const whisper = whisperPath();
    if (!whisper) throw new Error('whisper-Engine fehlt (auf Windows bauen/installieren).');
    const model = modelPathFor(config.model);
    if (!model) throw new Error(`Modell „${config.model}" nicht installiert.`);

    // 1) ffmpeg → 16-kHz-Mono-WAV
    job.status = 'preparing';
    job.progress = 0;
    onChange();
    await spawnStep(ffmpegPath(), [
      '-y',
      '-i',
      job.filePath,
      '-ar',
      '16000',
      '-ac',
      '1',
      '-c:a',
      'pcm_s16le',
      wav,
    ]);
    if (canceled.has(job.id)) return fail('');

    // 2) whisper.cpp → Untertitel
    job.status = 'transcribing';
    onChange();
    const dir = config.outputDir ?? dirname(job.filePath);
    const outBase = join(dir, basename(job.filePath, extname(job.filePath)));
    const args = ['-m', model, '-f', wav, '-l', config.language, '-of', outBase, '-pp'];
    if (config.task === 'translate') args.push('-tr');
    for (const f of config.formats) args.push(formatFlag(f));

    await spawnStep(whisper, args, (line) => {
      const m = /progress\s*=\s*(\d+)\s*%/.exec(line);
      if (m) {
        const p = Math.min(1, Number(m[1]) / 100);
        if (p !== job.progress) {
          job.progress = p;
          onChange();
        }
      }
    });
    if (canceled.has(job.id)) return fail('');

    job.outputs = config.formats.map((f) => `${outBase}.${f}`).filter((p) => existsSync(p));
    job.status = 'done';
    job.progress = 1;
    cleanup(wav);
    onChange();
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  } finally {
    if (currentJobId === job.id) currentJobId = null;
    canceled.delete(job.id);
    current = null;
  }
}

/** Spawnt einen Prozess; resolved bei Exit 0, rejected sonst. `onLine` bekommt stderr-Zeilen. */
function spawnStep(bin: string, args: string[], onLine?: (line: string) => void): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(bin, args, { windowsHide: true });
    current = child;
    let errBuf = '';
    let lineBuf = '';

    const handle = (data: Buffer): void => {
      const text = data.toString();
      errBuf = (errBuf + text).slice(-4000);
      if (onLine) {
        lineBuf += text;
        const parts = lineBuf.split(/\r|\n/);
        lineBuf = parts.pop() ?? '';
        for (const p of parts) onLine(p);
      }
    };
    child.stderr?.on('data', handle);
    child.stdout?.on('data', handle);

    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(errBuf.trim().split(/\r|\n/).slice(-2).join(' ') || `Exit-Code ${code}`));
    });
  });
}

function formatFlag(f: OutputFormat): string {
  return f === 'srt' ? '-osrt' : f === 'vtt' ? '-ovtt' : '-otxt';
}

function cleanup(wav: string): void {
  try {
    if (existsSync(wav)) rmSync(wav, { force: true });
  } catch {
    /* ignore */
  }
}
