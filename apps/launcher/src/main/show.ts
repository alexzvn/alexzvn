import { dialog } from 'electron';
import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { parseShow, serializeShow, showOpenUrl, SHOW_FILE_EXT, type Show } from '@jm/show';
import { getLog } from '@jm/app-runtime';
import type { ActionResult } from '@shared/types';
import { getTool } from './manifest';
import { openTool } from './launch';

// ─────────────────────────────────────────────────────────────────────────────
// Show-Orchestrierung: eine .jmshow öffnen und alle referenzierten Tools
// koordiniert starten. Jedem Tool wird der Deep-Link jmps://open?show=<pfad>
// als Argument mitgegeben — die App lädt daraus später ihren eigenen Teil (B4).
// ─────────────────────────────────────────────────────────────────────────────

/** Liest eine Show und startet ihre installierten Tools mit dem Show-Deep-Link. */
export async function openShow(showPath: string): Promise<ActionResult> {
  let show;
  try {
    show = parseShow(readFileSync(showPath, 'utf8'));
  } catch (e) {
    const message = `Show konnte nicht gelesen werden: ${(e as Error).message}`;
    getLog().error(message);
    return { ok: false, message };
  }

  const deepLink = showOpenUrl(showPath);
  let launched = 0;
  const missing: string[] = [];

  for (const ref of show.tools) {
    const tool = getTool(ref.appId);
    if (!tool) {
      missing.push(ref.appId);
      continue;
    }
    const res = await openTool(tool, [deepLink]);
    if (res.ok) launched += 1;
    else missing.push(tool.name);
  }

  const message =
    `Show „${show.name}": ${launched}/${show.tools.length} Tools gestartet` +
    (missing.length ? ` · nicht verfügbar: ${missing.join(', ')}` : '');
  getLog().info(message);
  return { ok: launched > 0, message };
}

/** Öffnet einen Datei-Dialog zur Auswahl einer .jmshow und startet sie. */
export async function openShowDialog(): Promise<ActionResult> {
  const result = await dialog.showOpenDialog({
    title: 'Show öffnen',
    properties: ['openFile'],
    filters: [{ name: 'JM Show', extensions: [SHOW_FILE_EXT.replace(/^\./, '')] }],
  });
  if (result.canceled || !result.filePaths[0]) return { ok: false };
  return openShow(result.filePaths[0]);
}

/** Speichert eine im Launcher zusammengestellte Show als .jmshow (Save-Dialog). */
export async function saveShow(show: Show): Promise<ActionResult> {
  const ext = SHOW_FILE_EXT.replace(/^\./, '');
  const safeName = (show.name || 'show').replace(/[\\/:*?"<>|]/g, '_');
  const result = await dialog.showSaveDialog({
    title: 'Show speichern',
    defaultPath: `${safeName}.${ext}`,
    filters: [{ name: 'JM Show', extensions: [ext] }],
  });
  if (result.canceled || !result.filePath) return { ok: false };
  try {
    await writeFile(result.filePath, serializeShow(show, new Date().toISOString()), 'utf8');
  } catch (e) {
    const message = `Show konnte nicht gespeichert werden: ${(e as Error).message}`;
    getLog().error(message);
    return { ok: false, message };
  }
  return { ok: true, message: `Show „${show.name}" gespeichert.` };
}

/** Datei-Dialog zur Auswahl eines Tool-Dokuments (z. B. .jmpres, .jmdaw). */
export async function pickShowDocument(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    title: 'Dokument wählen',
    properties: ['openFile'],
    filters: [
      { name: 'Tool-Dokumente', extensions: ['jmpres', 'jmdaw'] },
      { name: 'Alle Dateien', extensions: ['*'] },
    ],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return result.filePaths[0];
}
