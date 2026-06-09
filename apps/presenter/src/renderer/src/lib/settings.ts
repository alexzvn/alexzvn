// Small persistent UI preferences (localStorage). Kept trivial — no store needed.

const EXPAND_KEY = 'jmpr.expandPptxBuilds';

/** Experimental: split PPTX on-click animations into per-step slides on import. */
export function getExpandPptxBuilds(): boolean {
  try {
    return localStorage.getItem(EXPAND_KEY) === '1';
  } catch {
    return false;
  }
}

export function setExpandPptxBuilds(value: boolean): void {
  try {
    localStorage.setItem(EXPAND_KEY, value ? '1' : '0');
  } catch {
    // ignore (private mode etc.) — defaults to off
  }
}
