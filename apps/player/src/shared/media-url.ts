// Eigenes Schema, über das der Main-Prozess lokale Mediendateien an den Renderer
// ausliefert — umgeht den file://-Web-Security-Stress und liefert Range-Support
// fürs Scrubbing. Schema-String wird in main (Protokoll-Handler) UND renderer
// (URL-Bau) gebraucht, darum hier geteilt.
export const MEDIA_SCHEME = 'jmedia';

/** Lokalen Pfad → vom Renderer ladbare URL. */
export function mediaUrl(path: string): string {
  return `${MEDIA_SCHEME}://local/?path=${encodeURIComponent(path)}`;
}
