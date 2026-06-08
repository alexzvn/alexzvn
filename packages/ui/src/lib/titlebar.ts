import type { CSSProperties } from 'react';

// Die JM-Hauptfenster laufen auf macOS mit titleBarStyle 'hiddenInset' (siehe
// @jm/electron-kit / die main/index.ts der Tools) — es gibt also KEINE native
// Titelleiste zum Verschieben. Mit diesen Helfern wird der Header selbst zur
// Ziehfläche. Im Browser/PWA ist `-webkit-app-region` ein No-op und
// `isElectronMac` false, sodass dort kein Ampel-Freiraum entsteht.

/** Macht ein Element zur Fenster-Ziehfläche (auf den Header legen). */
export const dragRegion = { WebkitAppRegion: 'drag' } as CSSProperties;

/** Hebt die Ziehfläche wieder auf — auf Buttons/Nav im Header legen, sonst nicht klickbar. */
export const noDragRegion = { WebkitAppRegion: 'no-drag' } as CSSProperties;

/**
 * true nur im Electron-Renderer auf macOS. Dort sitzt die Ampel (hiddenInset)
 * oben links über dem Inhalt — der Header braucht links Platz dafür.
 */
export const isElectronMac =
  typeof navigator !== 'undefined' &&
  /Electron/.test(navigator.userAgent) &&
  /Mac/i.test(navigator.userAgent);
