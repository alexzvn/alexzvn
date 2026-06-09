import { dialog, shell } from 'electron';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getMainWindow } from '@jm/electron-kit';
import type { ToolManifest } from '@jm/suite-manifest';
import type { ActionResult } from '@shared/types';
import { forgetInstalled, installPathFor } from './install-state';

/**
 * Deinstalliert ein vom Launcher installiertes Tool (Issue #7). Vor dem Eingriff
 * wird nativ bestätigt (destruktiv).
 * - Windows: startet den NSIS-Deinstaller, der als „Uninstall <Name>.exe" im
 *   Installationsordner neben der EXE liegt — entfernt App, Verknüpfungen und
 *   Registry-Einträge sauber (bloßes Löschen der EXE würde Reste hinterlassen).
 * - macOS: verschiebt das .app-Bundle in den Papierkorb (wiederherstellbar).
 */
export async function uninstallTool(tool: ToolManifest): Promise<ActionResult> {
  const path = installPathFor(tool);
  if (!path || !existsSync(path)) {
    // Datei schon weg → Record aufräumen, Status ist bereits „nicht installiert".
    forgetInstalled(tool.id);
    return { ok: true, message: `${tool.name} ist nicht (mehr) installiert.` };
  }

  const detail =
    process.platform === 'darwin'
      ? 'Die App wird in den Papierkorb verschoben.'
      : 'Der Windows-Deinstaller wird gestartet. Folge dem Assistenten, um die App zu entfernen.';
  const opts: Electron.MessageBoxOptions = {
    type: 'warning',
    buttons: ['Abbrechen', 'Deinstallieren'],
    defaultId: 0,
    cancelId: 0,
    title: `${tool.name} deinstallieren`,
    message: `${tool.name} wirklich deinstallieren?`,
    detail,
    noLink: true,
  };
  const win = getMainWindow();
  const { response } = await (win ? dialog.showMessageBox(win, opts) : dialog.showMessageBox(opts));
  if (response !== 1) return { ok: false }; // abgebrochen → keine Notice

  if (process.platform === 'darwin') {
    try {
      await shell.trashItem(path);
    } catch (e) {
      return { ok: false, message: `Deinstallation fehlgeschlagen: ${(e as Error).message}` };
    }
    forgetInstalled(tool.id);
    return { ok: true, message: `${tool.name} in den Papierkorb verschoben.` };
  }

  // Windows: NSIS-Deinstaller im Installationsordner suchen und starten.
  const dir = dirname(path);
  let uninstaller: string | undefined;
  try {
    uninstaller = readdirSync(dir).find((f) => /^Uninstall .*\.exe$/i.test(f));
  } catch {
    // Ordner nicht lesbar
  }
  if (!uninstaller) {
    return {
      ok: false,
      message: 'Deinstaller nicht gefunden — bitte über die Windows-Einstellungen (Apps) entfernen.',
    };
  }
  const err = await shell.openPath(join(dir, uninstaller));
  if (err) return { ok: false, message: `Deinstaller-Start fehlgeschlagen: ${err}` };
  // Der Assistent läuft asynchron weiter; die Datei-Existenz steuert den
  // Status (siehe getToolState). Den Versions-Record entfernen wir optimistisch
  // — bei einer Neuinstallation wird er ohnehin neu gesetzt.
  forgetInstalled(tool.id);
  return { ok: true, message: `Deinstaller für ${tool.name} gestartet.` };
}
