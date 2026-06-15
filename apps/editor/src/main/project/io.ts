import { BrowserWindow, dialog } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { migrateProject, PROJECT_FILE_EXT, type Project } from '@shared/project';
import type { OpenProjectResult, SaveProjectRequest, SaveProjectResult } from '@shared/ipc-types';

const FILTER = { name: 'JM-Editor-Projekt', extensions: [PROJECT_FILE_EXT] };

export async function openProject(win: BrowserWindow | null): Promise<OpenProjectResult | null> {
  const options: Electron.OpenDialogOptions = {
    properties: ['openFile'],
    filters: [FILTER, { name: 'Alle Dateien', extensions: ['*'] }],
  };
  const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];
  const raw = await readFile(filePath, 'utf8');
  const project = migrateProject(JSON.parse(raw));
  return { path: filePath, project };
}

export async function saveProject(
  win: BrowserWindow | null,
  req: SaveProjectRequest,
): Promise<SaveProjectResult | null> {
  let target = req.path;
  if (!target) {
    const defaultName = `${sanitize(req.project.name)}.${PROJECT_FILE_EXT}`;
    const options: Electron.SaveDialogOptions = { defaultPath: defaultName, filters: [FILTER] };
    const result = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) return null;
    target = result.filePath;
  }
  const project: Project = { ...req.project, updatedAt: Date.now() };
  await writeFile(target, JSON.stringify(project, null, 2), 'utf8');
  return { path: target };
}

function sanitize(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim() || 'Projekt';
}

export function projectBaseName(filePath: string): string {
  return path.basename(filePath, path.extname(filePath));
}
