import type { PresentationPayload, PresentationState, ScreenMode } from '@shared/types';
import {
  broadcastAll,
  closePresentationWindows,
  openAudienceWindow,
  openPresenterWindow,
  setPresentationClosedHandler,
} from './windows';

// The main process owns the live presentation so presenter + audience windows
// (separate renderers) always agree on the current slide.
let payload: PresentationPayload | null = null;
let state: PresentationState = { active: false, index: 0, total: 0, screen: 'live' };

// Subscribers notified on every state change (the network remote pushes these to
// connected phones via SSE). Kept here so present.ts stays the single source of
// truth — windows get the broadcast, the remote gets the callback.
const listeners = new Set<() => void>();
export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function clampIndex(i: number): number {
  if (state.total <= 0) return 0;
  return Math.max(0, Math.min(i, state.total - 1));
}

function publish(): void {
  broadcastAll('present:state', state);
  for (const cb of listeners) cb();
}

export function getPayload(): PresentationPayload | null {
  return payload;
}

export function getState(): PresentationState {
  return state;
}

/** Compact view for the phone remote: current/next titles + notes + position. */
export function getRemoteView(): {
  active: boolean;
  index: number;
  total: number;
  screen: ScreenMode;
  title: string;
  notes: string;
  nextTitle: string | null;
} {
  const slides = payload?.slides ?? [];
  const current = slides[state.index];
  const next = slides[state.index + 1];
  return {
    active: state.active,
    index: state.index,
    total: state.total,
    screen: state.screen,
    title: current?.title ?? '',
    notes: current?.notes ?? '',
    nextTitle: next ? next.title || `Folie ${state.index + 2}` : null,
  };
}

export function startPresentation(
  next: PresentationPayload,
  audienceDisplayId: number | null,
): void {
  payload = next;
  state = {
    active: true,
    index: clampIndexFor(next.slides.length, next.startIndex),
    total: next.slides.length,
    screen: 'live',
  };
  openPresenterWindow();
  openAudienceWindow(audienceDisplayId);
  // Windows pull the payload via present:getPayload once their renderer loads;
  // the initial state is broadcast as soon as they subscribe (they also call
  // present:getState on mount).
  publish();
}

function clampIndexFor(total: number, i: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(i, total - 1));
}

export function goto(index: number): void {
  // Navigating always clears a black/white pause screen — you want to see the
  // slide you just jumped to.
  state = { ...state, index: clampIndex(index), screen: 'live' };
  publish();
}

export function next(): void {
  goto(state.index + 1);
}

export function prev(): void {
  goto(state.index - 1);
}

/** Set the audience pause screen. Selecting the active mode again returns to live. */
export function setScreen(mode: ScreenMode): void {
  if (!state.active) return;
  const nextMode: ScreenMode = state.screen === mode ? 'live' : mode;
  state = { ...state, screen: nextMode };
  publish();
}

export function stopPresentation(): void {
  if (!state.active) return; // guard re-entrancy from window 'closed' events
  state = { active: false, index: 0, total: 0, screen: 'live' };
  payload = null;
  publish();
  closePresentationWindows();
}

// Closing either presentation window ends the presentation cleanly.
setPresentationClosedHandler(stopPresentation);
