export interface ScriptLine {
  /** Anzeigetext (bei Marker-Zeilen ohne führende #). */
  text: string;
  /** Marker-Zeile (begann mit #)? */
  marker: boolean;
  /** Leerzeile (erzeugt Absatzabstand)? */
  blank: boolean;
}

/**
 * Skript in Zeilen zerlegen. Zeilen, die mit `#` beginnen, werden zu Markern
 * (Kapitel/Abschnitt) — Sprungziele für „voriger/nächster Abschnitt".
 */
export function parseScript(script: string): ScriptLine[] {
  return script.split('\n').map((raw) => {
    const trimmed = raw.trimStart();
    if (trimmed.startsWith('#')) {
      return { text: trimmed.replace(/^#+\s*/, ''), marker: true, blank: false };
    }
    if (raw.trim() === '') return { text: '', marker: false, blank: true };
    return { text: raw, marker: false, blank: false };
  });
}
