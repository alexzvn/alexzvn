import { create } from 'zustand';
import type {
  ActionResult,
  FeedbackInput,
  InstallProgress,
  LauncherUpdate,
  SuiteSettingsInput,
  SuiteSettingsView,
  ToolManifest,
  ToolState,
} from '@shared/types';

function byId(states: ToolState[]): Record<string, ToolState> {
  return Object.fromEntries(states.map((s) => [s.id, s]));
}

interface ToolsStore {
  tools: ToolManifest[];
  states: Record<string, ToolState>;
  busy: Record<string, boolean>;
  progress: Record<string, InstallProgress>;
  settings: SuiteSettingsView | null;
  settingsOpen: boolean;
  loading: boolean;
  notice: string | null;
  version: string | null;
  launcherUpdate: LauncherUpdate | null;
  load: () => Promise<void>;
  checkUpdates: () => Promise<void>;
  loadLauncherUpdate: () => Promise<void>;
  updateLauncher: () => Promise<void>;
  open: (id: string) => Promise<void>;
  install: (id: string) => Promise<void>;
  update: (id: string) => Promise<void>;
  uninstall: (id: string) => Promise<void>;
  setNotice: (notice: string | null) => void;
  openSettings: () => void;
  closeSettings: () => void;
  saveSettings: (input: SuiteSettingsInput) => Promise<void>;
  feedbackOpen: boolean;
  openFeedback: () => void;
  closeFeedback: () => void;
  submitFeedback: (input: FeedbackInput) => Promise<ActionResult>;
}

let progressSubscribed = false;

export const useTools = create<ToolsStore>((set) => {
  async function run(
    id: string,
    action: () => Promise<ActionResult>,
    refresh = false,
  ): Promise<void> {
    set((s) => ({ busy: { ...s.busy, [id]: true } }));
    try {
      const res = await action();
      if (res.message) set({ notice: res.message });
      if (refresh) {
        // checkUpdates liefert die plattenbasierten Zustände inkl. Live-Update-
        // Overlay — nach (De-)Installation also direkt der aktuelle Stand.
        const states = await window.jmps.checkUpdates();
        set({ states: byId(states) });
      }
    } catch (e) {
      set({ notice: (e as Error).message });
    } finally {
      set((s) => ({ busy: { ...s.busy, [id]: false } }));
    }
  }

  return {
    tools: [],
    states: {},
    busy: {},
    progress: {},
    settings: null,
    settingsOpen: false,
    feedbackOpen: false,
    loading: true,
    notice: null,
    version: null,
    launcherUpdate: null,

    load: async () => {
      if (!progressSubscribed) {
        progressSubscribed = true;
        window.jmps.onProgress((p) => {
          set((s) => ({ progress: { ...s.progress, [p.id]: p } }));
        });
        window.jmps.onAppEvent(async (e) => {
          if (e.type === 'notice') {
            set({ notice: e.message });
          } else if (e.type === 'manifest-changed') {
            const [tools, states] = await Promise.all([
              window.jmps.listTools(),
              window.jmps.getState(),
            ]);
            set({ tools, states: byId(states) });
          }
        });
        // Nach Rückkehr zum Launcher (z. B. wenn der NSIS-Installer durch ist
        // oder der Rechner wieder online geht) Status + Updates neu prüfen —
        // sonst bliebe die Karte bis zum Reload veraltet.
        window.addEventListener('focus', () => {
          void useTools.getState().checkUpdates();
          void useTools.getState().loadLauncherUpdate();
        });
      }
      const [tools, states, settings, version] = await Promise.all([
        window.jmps.listTools(),
        window.jmps.getState(),
        window.jmps.getSettings(),
        window.jmps.getVersion(),
      ]);
      set({ tools, states: byId(states), settings, version, loading: false });
      // Zustände sofort rendern, die (langsameren, online) Prüfungen danach.
      void useTools.getState().checkUpdates();
      void useTools.getState().loadLauncherUpdate();
    },

    checkUpdates: async () => {
      try {
        const states = await window.jmps.checkUpdates();
        set({ states: byId(states) });
      } catch {
        // offline / Quelle nicht erreichbar → bestehende Zustände behalten
      }
    },

    loadLauncherUpdate: async () => {
      try {
        set({ launcherUpdate: await window.jmps.getLauncherUpdate() });
      } catch {
        // offline / kein Token → kein Launcher-Update-Hinweis
      }
    },

    updateLauncher: () => run('launcher', () => window.jmps.updateLauncher()),

    open: (id) => run(id, () => window.jmps.open(id)),
    install: (id) => run(id, () => window.jmps.install(id), true),
    update: (id) => run(id, () => window.jmps.update(id), true),
    uninstall: (id) => run(id, () => window.jmps.uninstall(id), true),
    setNotice: (notice) => set({ notice }),

    openSettings: () => set({ settingsOpen: true }),
    closeSettings: () => set({ settingsOpen: false }),
    saveSettings: async (input) => {
      const settings = await window.jmps.setSettings(input);
      set({ settings, settingsOpen: false, notice: 'Einstellungen gespeichert.' });
    },

    openFeedback: () => set({ feedbackOpen: true }),
    closeFeedback: () => set({ feedbackOpen: false }),
    submitFeedback: async (input) => {
      const res = await window.jmps.submitFeedback(input);
      set({ notice: res.message ?? (res.ok ? 'Danke!' : 'Senden fehlgeschlagen.') });
      if (res.ok) set({ feedbackOpen: false });
      return res;
    },
  };
});
