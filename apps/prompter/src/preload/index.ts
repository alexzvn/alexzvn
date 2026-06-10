import { contextBridge, ipcRenderer } from 'electron';
import type {
  DisplayInfo,
  JmpromptApi,
  PartialPrompterConfig,
  PrompterState,
} from '@shared/types';

const api: JmpromptApi = {
  platform: process.platform,
  getState: () => ipcRenderer.invoke('prompter:getState') as Promise<PrompterState>,
  setConfig: (patch: PartialPrompterConfig) =>
    ipcRenderer.invoke('prompter:setConfig', patch) as Promise<PrompterState>,
  onState: (cb) => {
    const listener = (_e: unknown, s: PrompterState): void => cb(s);
    ipcRenderer.on('prompter:state', listener);
    return () => ipcRenderer.off('prompter:state', listener);
  },
  transport: {
    play: () => ipcRenderer.invoke('prompter:play') as Promise<PrompterState>,
    pause: () => ipcRenderer.invoke('prompter:pause') as Promise<PrompterState>,
    toggle: () => ipcRenderer.invoke('prompter:toggle') as Promise<PrompterState>,
    seek: (em: number) => ipcRenderer.invoke('prompter:seek', em) as Promise<PrompterState>,
    nudge: (deltaEm: number) => ipcRenderer.invoke('prompter:nudge', deltaEm) as Promise<PrompterState>,
    reset: () => ipcRenderer.invoke('prompter:reset') as Promise<PrompterState>,
  },
  output: {
    displays: () => ipcRenderer.invoke('output:displays') as Promise<DisplayInfo[]>,
    open: (displayId) => ipcRenderer.invoke('output:open', displayId) as Promise<void>,
    close: () => ipcRenderer.invoke('output:close') as Promise<void>,
    isOpen: () => ipcRenderer.invoke('output:isOpen') as Promise<boolean>,
  },
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('jmprompt', api);
} else {
  // @ts-expect-error fallback when context isolation is off
  window.jmprompt = api;
}
