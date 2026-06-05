import { exposeApi, invoke, listen } from '@jm/electron-kit/preload';
import type {
  ActionResult,
  InstallProgress,
  JmpsApi,
  SuiteSettingsInput,
  SuiteSettingsView,
  ToolManifest,
  ToolState,
} from '@shared/types';

const api: JmpsApi = {
  platform: process.platform,
  listTools: () => invoke<ToolManifest[]>('suite:list'),
  getState: () => invoke<ToolState[]>('suite:state'),
  open: (id) => invoke<ActionResult>('tool:open', id),
  install: (id) => invoke<ActionResult>('tool:install', id),
  update: (id) => invoke<ActionResult>('tool:update', id),
  openExternal: (url) => invoke<void>('shell:openExternal', url),
  getSettings: () => invoke<SuiteSettingsView>('settings:get'),
  setSettings: (settings: SuiteSettingsInput) => invoke<SuiteSettingsView>('settings:set', settings),
  onProgress: (cb) => listen<InstallProgress>('suite:progress', cb),
};

exposeApi('jmps', api);
