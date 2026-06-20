/**
 * Anzeigename in der Launcher-Übersicht: ohne "JM"-Vorsatz (Issue #26). Die Apps
 * selbst behalten "JM" im Titel — das betrifft nur die Kachel-Überschrift hier.
 */
export function displayName(name: string): string {
  return name.replace(/^JM\s+/i, '').trim() || name;
}

/** Zweistelliges Kürzel aus dem Tool-Namen (ohne "JM") für die Kachel. */
export function monogram(name: string): string {
  const rest = name.replace(/^JM\s+/i, '').trim();
  const words = rest.split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return rest.slice(0, 2).toUpperCase();
}
