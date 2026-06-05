import { create } from 'zustand';
import type { SessionUser } from '@shared/protocol';

const STORAGE_KEY = 'jms.session';

interface PersistedSession {
  token: string;
  user: SessionUser;
}

function loadPersisted(): PersistedSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedSession;
  } catch {
    return null;
  }
}

function savePersisted(session: PersistedSession | null): void {
  if (typeof window === 'undefined') return;
  if (!session) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

interface SessionState {
  token: string | null;
  user: SessionUser | null;
  connected: boolean;
  setSession: (token: string, user: SessionUser) => void;
  clearSession: () => void;
  setConnected: (connected: boolean) => void;
}

const initial = loadPersisted();

export const useSession = create<SessionState>((set) => ({
  token: initial?.token ?? null,
  user: initial?.user ?? null,
  connected: false,
  setSession: (token, user) => {
    savePersisted({ token, user });
    set({ token, user });
  },
  clearSession: () => {
    savePersisted(null);
    set({ token: null, user: null });
  },
  setConnected: (connected) => set({ connected }),
}));
