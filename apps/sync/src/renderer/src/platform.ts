// Platform adapter: the same renderer runs inside the Electron shell (where the
// preload exposes `window.jms`) and as a standalone PWA in the browser (where it
// does not). Everything platform-specific goes through `host` so the views stay
// identical across both targets.

const jms = typeof window !== 'undefined' ? window.jms : undefined;

export type Runtime = 'electron' | 'web';

export const runtime: Runtime = jms ? 'electron' : 'web';

export const host = {
  runtime,

  /** True when running inside the Electron desktop shell. */
  get isElectron(): boolean {
    return runtime === 'electron';
  },

  async appVersion(): Promise<string> {
    if (jms) return jms.app.version();
    return 'web';
  },

  async openExternal(url: string): Promise<void> {
    if (jms) {
      await jms.shell.openExternal(url);
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  },
};
