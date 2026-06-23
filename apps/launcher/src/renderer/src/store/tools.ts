import { create } from 'zustand';
import { useChangelog } from '@/store/changelog';
import type {
  ActionResult,
  FeedbackInput,
  InstallProgress,
  LauncherUpdate,
  PresenceRecord,
  SuiteSettingsInput,
  SuiteSettingsView,
  ToolManifest,
  ToolState,
} from '@shared/types';
import type { Show } from '@jm/show';

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
  updatingAll: boolean;
  presence: PresenceRecord[];
  systemOpen: boolean;
  showEditorOpen: boolean;
  load: () => Promise<void>;
  loadPresence: () => Promise<void>;
  openShow: () => Promise<void>;
  openShowEditor: () => void;
  closeShowEditor: () => void;
  saveShow: (show: Show) => Promise<boolean>;
  openSystem: () => void;
  closeSystem: () => void;
  checkUpdates: () => Promise<void>;
  loadLauncherUpdate: () => Promise<void>;
  updateLauncher: () => Promise<void>;
  open: (id: string) => Promise<void>;
  install: (id: string) => Promise<void>;
  update: (id: string) => Promise<void>;
  updateAll: () => Promise<void>;
  uninstall: (id: string) => Promise<void>;
  setNotice: (notice: string | null) => void;
  openSettings: () => void;
  closeSettings: () => void;
  saveSettings: (input: SuiteSettingsInput) => Promise<void>;
  feedbackOpen: boolean;
  openFeedback: () => void;
  closeFeedback: () => void;
  submitFeedback: (input: FeedbackInput) => Promise<ActionResult>;
  /** Sichtbare Patch Notes: { app, optional hervorgehobene Version } oder null. */
  patchNotes: { app: string; highlight?: string } | null;
  openPatchNotes: (view?: { app: string; highlight?: string }) => void;
  closePatchNotes: () => void;
}

const SEEN_VERSION_KEY = 'jmps:lastSeenVersion';

function readSeenVersion(): string | null {
  try {
    return localStorage.getItem(SEEN_VERSION_KEY);
  } catch {
    return null;
  }
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
    updatingAll: false,
    presence: [],
    systemOpen: false,
    showEditorOpen: false,
    patchNotes: null,

    load: async () => {
      if (!progressSubscribed) {
        progressSubscribed = true;
        window.jmps.onProgress((p) => {
          set((s) => ({ progress: { ...s.progress, [p.id]: p } }));
          // Abschluss (auch verzögert, nachdem ein interaktiver Installer durch
          // ist) → Zustände nachladen, damit die Tool-Karte auf „installiert"
          // umschlägt, ohne dass der User das Fenster neu fokussieren muss.
          if (p.phase === 'done') void useTools.getState().checkUpdates();
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
          } else if (e.type === 'changelog-changed') {
            // Live aktualisierte App-Patchnotes übernehmen (Issue #19).
            await useChangelog.getState().load();
          } else if (e.type === 'presence-changed') {
            // Ein Tool ist gestartet/gestoppt → Health-Dashboard auffrischen.
            await useTools.getState().loadPresence();
          }
        });
        // Nach Rückkehr zum Launcher (z. B. wenn der NSIS-Installer durch ist
        // oder der Rechner wieder online geht) Status + Updates neu prüfen —
        // sonst bliebe die Karte bis zum Reload veraltet.
        window.addEventListener('focus', () => {
          void useTools.getState().checkUpdates();
          void useTools.getState().loadLauncherUpdate();
          void useTools.getState().loadPresence();
        });
        // Hintergrund: regelmäßig auf Updates prüfen, auch ohne Fokuswechsel —
        // so aktualisiert ein länger offener Launcher seine Update-Badges selbst.
        // (Die Versionsabfrage ist serverseitig 5 min gecacht; 30 min reicht.)
        setInterval(() => {
          void useTools.getState().checkUpdates();
          void useTools.getState().loadLauncherUpdate();
        }, 30 * 60 * 1000);
      }
      const [tools, states, settings, version] = await Promise.all([
        window.jmps.listTools(),
        window.jmps.getState(),
        window.jmps.getSettings(),
        window.jmps.getVersion(),
        useChangelog.getState().load(),
      ]);
      set({ tools, states: byId(states), settings, version, loading: false });
      // „Was ist neu?" nach einem Launcher-Update (oder beim ersten Start dieser
      // Version) genau einmal zeigen — sofern für die Version Notes vorliegen.
      if (version && readSeenVersion() !== version && useChangelog.getState().entryFor('launcher', version)) {
        set({ patchNotes: { app: 'launcher', highlight: version } });
      }
      // Zustände sofort rendern, die (langsameren, online) Prüfungen danach.
      void useTools.getState().checkUpdates();
      void useTools.getState().loadLauncherUpdate();
      void useTools.getState().loadPresence();
    },

    loadPresence: async () => {
      try {
        set({ presence: await window.jmps.getPresence() });
      } catch {
        // Hub nicht erreichbar → bestehenden Stand behalten
      }
    },

    openShow: async () => {
      const res = await window.jmps.openShow();
      if (res.message) set({ notice: res.message });
      // Nach dem koordinierten Start meldet sich Presence neu → Dashboard frisch.
      void useTools.getState().loadPresence();
    },

    openShowEditor: () => set({ showEditorOpen: true }),
    closeShowEditor: () => set({ showEditorOpen: false }),
    saveShow: async (show) => {
      const res = await window.jmps.saveShow(show);
      if (res.message) set({ notice: res.message });
      return res.ok;
    },

    openSystem: () => {
      set({ systemOpen: true });
      void useTools.getState().loadPresence();
    },
    closeSystem: () => set({ systemOpen: false }),

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
    updateAll: async () => {
      // Schnappschuss der aktuell aktualisierbaren Tools nehmen (die Liste
      // ändert sich, während die Updates durchlaufen) und sequentiell updaten —
      // nicht parallel, sonst starten mehrere Installer gleichzeitig.
      const { states, update } = useTools.getState();
      const ids = Object.values(states)
        .filter((s) => s.status === 'update-available')
        .map((s) => s.id);
      if (ids.length === 0) return;
      set({ updatingAll: true });
      try {
        for (const id of ids) await update(id);
      } finally {
        set({ updatingAll: false });
      }
    },
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

    openPatchNotes: (view) => set({ patchNotes: view ?? { app: 'launcher' } }),
    closePatchNotes: () =>
      set((s) => {
        // Launcher-Notes als „gesehen" merken → erscheinen nicht erneut für diese Version.
        if (s.patchNotes?.app === 'launcher' && s.version) {
          try {
            localStorage.setItem(SEEN_VERSION_KEY, s.version);
          } catch {
            // localStorage nicht verfügbar → ignorieren
          }
        }
        return { patchNotes: null };
      }),
  };
});
