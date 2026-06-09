// Program-Output: Aufnahme (WebM-Datei) + RTMP-Stream (ffmpeg via @jm/media).
//
// Der Renderer kodiert den Program-Canvas per MediaRecorder zu WebM und schickt
// die Chunks hierher:
//   - Aufnahme: Chunks → fs-WriteStream (.webm, direkt, ohne ffmpeg).
//   - Stream:   Chunks → ffmpeg stdin → transcode H.264 + stille AAC-Spur
//               (anullsrc, damit YouTube/Twitch & Co. die FLV akzeptieren) → RTMP.
// Pro Output läuft ein eigener MediaRecorder im Renderer → jeder Sink bekommt
// einen sauberen WebM-Header (kein Late-Join-Problem).
import { BrowserWindow, dialog, ipcMain } from 'electron';
import { createWriteStream, type WriteStream } from 'node:fs';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { spawnFfmpeg } from '@jm/media';

let targetWindow: BrowserWindow | null = null;

// Aufnahme
let recStream: WriteStream | null = null;
let recPath: string | null = null;

// Stream
let streamChild: ChildProcessWithoutNullStreams | null = null;
let streamAbort: AbortController | null = null;
let streaming = false;

export function attachOutputWindow(win: BrowserWindow): void {
  targetWindow = win;
}

function emitStatus(): void {
  targetWindow?.webContents.send('output:status', {
    recording: recStream != null,
    streaming,
    recPath,
  });
}

function emitError(scope: 'record' | 'stream', message: string): void {
  targetWindow?.webContents.send('output:error', { scope, message });
}

function tailLine(s: string): string {
  const lines = s.trim().split('\n').filter(Boolean);
  return lines[lines.length - 1] ?? '';
}

export function registerOutputIpc(): void {
  // ---- Aufnahme ----
  ipcMain.handle('output:recStart', async () => {
    if (!targetWindow) return { ok: false };
    const ts = new Date().toISOString().replace(/:/g, '-').replace('T', '_').slice(0, 19);
    const res = await dialog.showSaveDialog(targetWindow, {
      title: 'Aufnahme speichern',
      defaultPath: `JM-Switcher-${ts}.webm`,
      filters: [{ name: 'WebM', extensions: ['webm'] }],
    });
    if (res.canceled || !res.filePath) return { ok: false };
    try {
      recPath = res.filePath;
      recStream = createWriteStream(recPath);
      recStream.on('error', (e) => {
        emitError('record', e.message);
        closeRecording();
      });
      emitStatus();
      return { ok: true, path: recPath };
    } catch (e) {
      recStream = null;
      recPath = null;
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.on('output:recChunk', (_e, chunk: Uint8Array) => {
    if (recStream && chunk?.byteLength) recStream.write(Buffer.from(chunk));
  });

  ipcMain.on('output:recStop', () => closeRecording());

  // ---- Stream ----
  ipcMain.handle('output:streamStart', (_e, opts: { url?: string }) => {
    const url = (opts?.url ?? '').trim();
    if (!url) return { ok: false, error: 'Keine RTMP-URL angegeben' };
    if (streaming) return { ok: true };

    streamAbort = new AbortController();
    const args = [
      '-hide_banner',
      '-loglevel',
      'warning',
      // Live-WebM vom Renderer-MediaRecorder.
      '-f',
      'webm',
      '-i',
      'pipe:0',
      // Stille Stereo-Tonspur, an Echtzeit gekoppelt (-re), bis Audio-Mix kommt.
      '-re',
      '-f',
      'lavfi',
      '-i',
      'anullsrc=channel_layout=stereo:sample_rate=44100',
      '-map',
      '0:v:0',
      '-map',
      '1:a:0',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-tune',
      'zerolatency',
      '-pix_fmt',
      'yuv420p',
      '-g',
      '60',
      '-b:v',
      '4500k',
      '-maxrate',
      '4500k',
      '-bufsize',
      '9000k',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-ar',
      '44100',
      '-f',
      'flv',
      url,
    ];

    streaming = true;
    let errLog = '';
    spawnFfmpeg(args, {
      signal: streamAbort.signal,
      onSpawn: (child) => {
        streamChild = child;
        // EPIPE beim Kill/Stop ist erwartbar — nicht crashen.
        child.stdin.on('error', () => {});
      },
      onStderr: (s) => {
        if (errLog.length < 4000) errLog += s;
      },
    })
      .then((r) => {
        const wasStreaming = streaming;
        streamChild = null;
        streaming = false;
        emitStatus();
        // Code 255 = via SIGKILL (regulärer Stop). Nur echte Fehler melden.
        if (wasStreaming && r.code && r.code !== 0 && r.code !== 255) {
          emitError('stream', `ffmpeg beendet (Code ${r.code}). ${tailLine(errLog)}`);
        }
      })
      .catch((e) => {
        streamChild = null;
        streaming = false;
        emitStatus();
        emitError('stream', `ffmpeg-Start fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`);
      });

    emitStatus();
    return { ok: true };
  });

  ipcMain.on('output:streamChunk', (_e, chunk: Uint8Array) => {
    const stdin = streamChild?.stdin;
    if (stdin && stdin.writable && chunk?.byteLength) stdin.write(Buffer.from(chunk));
  });

  ipcMain.on('output:streamStop', () => stopStreaming());
}

function closeRecording(): void {
  if (recStream) {
    recStream.end();
    recStream = null;
  }
  recPath = null;
  emitStatus();
}

function stopStreaming(): void {
  // stdin schließen → ffmpeg läuft aus und exitet; .then() räumt auf.
  if (streamChild?.stdin?.writable) {
    try {
      streamChild.stdin.end();
    } catch {
      // egal
    }
  } else if (!streamChild) {
    streaming = false;
    emitStatus();
  }
}

/** Beim Beenden/Fenster-Schließen: alles hart stoppen. */
export function stopOutput(): void {
  closeRecording();
  if (streamChild) {
    streamAbort?.abort(); // SIGKILL
    streamChild = null;
  }
  streamAbort = null;
  streaming = false;
}
