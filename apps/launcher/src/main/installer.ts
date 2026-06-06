import { app, shell } from 'electron';
import { createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ToolManifest } from '@jm/suite-manifest';
import type { ActionResult, InstallProgress } from '@shared/types';
import { getReleaseSource } from './release-source';
import { recordInstalled } from './install-state';

type Emit = (progress: InstallProgress) => void;

async function download(
  url: string,
  headers: Record<string, string>,
  dest: string,
  expectedSize: number,
  onProgress: (received: number, total: number) => void,
): Promise<void> {
  const res = await fetch(url, { headers });
  if (!res.ok || !res.body) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  const total = Number(res.headers.get('content-length')) || expectedSize || 0;
  let received = 0;

  // Bytes IN der Pipeline zählen (Transform), nicht über einen separaten
  // `data`-Listener: letzterer schaltet den Stream in den flowing mode, wodurch
  // je nach Timing die ersten Chunks verloren gehen können, bevor `pipeline` die
  // Pipe verdrahtet → abgeschnittenes File und „NSIS integrity check failed".
  const counter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      received += chunk.length;
      onProgress(received, total);
      cb(null, chunk);
    },
  });

  const source = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]);
  await pipeline(source, counter, createWriteStream(dest));

  // Unvollständige Downloads früh und klar abfangen, statt einen kaputten
  // Installer zu starten (der dann mit kryptischem NSIS-Fehler abbricht).
  if (expectedSize && received !== expectedSize) {
    throw new Error(`unvollständiger Download: ${received}/${expectedSize} Bytes`);
  }
}

/**
 * Lädt das passende Release-Artefakt aus der konfigurierten Quelle und startet
 * den lokalen Installer (win: NSIS-EXE, mac: DMG öffnen). Merkt sich die Version.
 */
export async function installTool(tool: ToolManifest, emit: Emit): Promise<ActionResult> {
  const source = getReleaseSource();
  if (!source) {
    return {
      ok: false,
      message: 'Keine Release-Quelle konfiguriert — Token oder Proxy in den Einstellungen hinterlegen.',
    };
  }

  let asset;
  try {
    asset = await source.latest(tool);
  } catch (e) {
    const message = `Release-Abfrage fehlgeschlagen: ${(e as Error).message}`;
    emit({ id: tool.id, phase: 'error', message });
    return { ok: false, message };
  }
  if (!asset) {
    const message = 'Kein passendes Artefakt für diese Plattform gefunden.';
    emit({ id: tool.id, phase: 'error', message });
    return { ok: false, message };
  }

  const dest = join(app.getPath('temp'), asset.fileName);
  try {
    emit({ id: tool.id, phase: 'download', received: 0, total: asset.size, pct: 0 });
    await download(asset.assetUrl, asset.downloadHeaders, dest, asset.size, (received, total) => {
      emit({
        id: tool.id,
        phase: 'download',
        received,
        total,
        pct: total ? Math.round((received / total) * 100) : undefined,
      });
    });
  } catch (e) {
    const message = `Download fehlgeschlagen: ${(e as Error).message}`;
    emit({ id: tool.id, phase: 'error', message });
    return { ok: false, message };
  }

  emit({ id: tool.id, phase: 'install', message: 'Installer wird gestartet…' });
  try {
    // shell.openPath = Doppelklick-Verhalten: Windows zeigt den NSIS-Assistenten
    // (und bei unsigniert den SmartScreen-Dialog zum Bestätigen), macOS mountet
    // das DMG. Ein detached `spawn` der unsignierten EXE wurde von SmartScreen
    // still geblockt — es erschien gar kein Installer-Fenster.
    const err = await shell.openPath(dest);
    if (err) throw new Error(err);
  } catch (e) {
    const message = `Installer-Start fehlgeschlagen: ${(e as Error).message}`;
    emit({ id: tool.id, phase: 'error', message });
    return { ok: false, message };
  }

  recordInstalled(tool.id, asset.version);
  const message = `${tool.name} ${asset.version}: heruntergeladen, Installer gestartet.`;
  emit({ id: tool.id, phase: 'done', message });
  return { ok: true, message };
}
