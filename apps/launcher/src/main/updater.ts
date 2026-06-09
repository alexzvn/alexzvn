import { app } from 'electron';
import electronUpdater from 'electron-updater';
import type { AppEvent } from '@shared/types';

const { autoUpdater } = electronUpdater;

type Emit = (event: AppEvent) => void;

/**
 * Self-Update der Suite via electron-updater. Läuft nur in der gepackten App und
 * nur, wenn eine Update-Quelle (publish-Config → app-update.yml) vorhanden ist.
 * Fehler werden geschluckt bzw. als dezente Notice gemeldet.
 */
export function initAutoUpdate(emit: Emit): void {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    emit({ type: 'notice', message: `Suite-Update ${info.version} verfügbar — wird geladen…` });
  });
  autoUpdater.on('update-downloaded', (info) => {
    emit({ type: 'notice', message: `Suite-Update ${info.version} bereit — beim nächsten Start aktiv.` });
  });
  autoUpdater.on('error', (err) => {
    emit({ type: 'notice', message: `Update-Prüfung fehlgeschlagen: ${err.message}` });
  });

  autoUpdater.checkForUpdatesAndNotify().catch(() => {
    // keine Update-Quelle konfiguriert / offline → ignorieren
  });
}
