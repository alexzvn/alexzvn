/** Zweistelliges Kürzel aus dem Tool-Namen (ohne "JM") für die Kachel. */
export function monogram(name: string): string {
  const rest = name.replace(/^JM\s+/i, '').trim();
  const words = rest.split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return rest.slice(0, 2).toUpperCase();
}
