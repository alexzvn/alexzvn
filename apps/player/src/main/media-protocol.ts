import { protocol } from 'electron';
import { createReadStream, statSync } from 'node:fs';
import { Readable } from 'node:stream';
import path from 'node:path';
import { MEDIA_SCHEME } from '@shared/media-url';

const MIME: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.mpg': 'video/mpeg',
  '.mpeg': 'video/mpeg',
  '.wmv': 'video/x-ms-wmv',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.aif': 'audio/aiff',
  '.aiff': 'audio/aiff',
  '.wma': 'audio/x-ms-wma',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function mimeFor(filePath: string): string {
  return MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

function webBody(stream: Readable): ReadableStream<Uint8Array> {
  return Readable.toWeb(stream) as unknown as ReadableStream<Uint8Array>;
}

/**
 * Registriert den `jmedia://`-Handler. Liefert lokale Dateien mit Range-Support
 * (HTTP 206), damit <video>/<audio> sauber scrubben können und WebAudio die
 * ganze Datei (200) holen kann. Muss nach app.whenReady() laufen; das Schema
 * selbst wird vorher per registerSchemesAsPrivileged freigeschaltet.
 */
export function registerMediaProtocol(): void {
  protocol.handle(MEDIA_SCHEME, (request) => {
    const filePath = new URL(request.url).searchParams.get('path');
    if (!filePath) return new Response('missing path', { status: 400 });

    let size: number;
    try {
      size = statSync(filePath).size;
    } catch {
      return new Response('not found', { status: 404 });
    }

    const mime = mimeFor(filePath);
    const cors = { 'Access-Control-Allow-Origin': '*' };
    const range = request.headers.get('range');

    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      let start = m && m[1] ? parseInt(m[1], 10) : 0;
      let end = m && m[2] ? parseInt(m[2], 10) : size - 1;
      if (!Number.isFinite(start) || start < 0) start = 0;
      if (!Number.isFinite(end) || end >= size) end = size - 1;
      if (start > end) start = 0;
      return new Response(webBody(createReadStream(filePath, { start, end })), {
        status: 206,
        headers: {
          ...cors,
          'Content-Type': mime,
          'Content-Length': String(end - start + 1),
          'Content-Range': `bytes ${start}-${end}/${size}`,
          'Accept-Ranges': 'bytes',
        },
      });
    }

    return new Response(webBody(createReadStream(filePath)), {
      status: 200,
      headers: {
        ...cors,
        'Content-Type': mime,
        'Content-Length': String(size),
        'Accept-Ranges': 'bytes',
      },
    });
  });
}
