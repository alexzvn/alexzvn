import type { PresentationPayload, PresentationState } from '@shared/types';
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
let state: PresentationState = { active: false, index: 0, total: 0, blackout: false };

function clampIndex(i: number): number {
  if (state.total <= 0) return 0;
  return Math.max(0, Math.min(i, state.total - 1));
}

function publish(): void {
  broadcastAll('present:state', state);
}

export function getPayload(): PresentationPayload | null {
  return payload;
}

export function getState(): PresentationState {
  return state;
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
    blackout: false,
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
  state = { ...state, index: clampIndex(index) };
  publish();
}

export function next(): void {
  goto(state.index + 1);
}

export function prev(): void {
  goto(state.index - 1);
}

export function stopPresentation(): void {
  if (!state.active) return; // guard re-entrancy from window 'closed' events
  state = { active: false, index: 0, total: 0, blackout: false };
  payload = null;
  publish();
  closePresentationWindows();
}

// Closing either presentation window ends the presentation cleanly.
setPresentationClosedHandler(stopPresentation);
