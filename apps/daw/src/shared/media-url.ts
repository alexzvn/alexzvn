// Eigenes Schema, über das der Main-Prozess lokale Mediendateien an den Renderer
// ausliefert — umgeht den file://-Web-Security-Stress und liefert Range-Support.
// Schema-String wird in main (Protokoll-Handler) UND renderer (URL-Bau, fetch →
// decodeAudioData) gebraucht, darum hier geteilt. (Übernommen aus JM Editor/Player.)
export const MEDIA_SCHEME = 'jmedia';

/** Lokalen Pfad → vom Renderer ladbare URL (mit Range-Support). */
export function mediaUrl(path: string): string {
  return `${MEDIA_SCHEME}://local/?path=${encodeURIComponent(path)}`;
}
