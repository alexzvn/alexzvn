import { contextBridge, ipcRenderer } from 'electron';

/**
 * Stellt eine API typsicher unter `window[name]` bereit — respektiert
 * contextIsolation und fällt sonst auf eine direkte Zuweisung zurück.
 */
export function exposeApi<T>(name: string, api: T): void {
  if (process.contextIsolated) {
    contextBridge.exposeInMainWorld(name, api);
  } else {
    // @ts-expect-error Fallback, wenn contextIsolation aus ist
    window[name] = api;
  }
}

/** Request/Reply-Aufruf an den Main-Prozess. */
export function invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T> {
  return ipcRenderer.invoke(channel, ...args) as Promise<T>;
}

/** Abonniert ein Event vom Main-Prozess und liefert eine Unsubscribe-Funktion. */
export function listen<T = unknown>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_event: unknown, payload: T) => cb(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.off(channel, listener);
}
