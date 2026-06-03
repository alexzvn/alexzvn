import { Placeholder } from '@/components/Placeholder';

export function GeneratorView() {
  return (
    <Placeholder
      badge="Phase 2 · folgt"
      title="Referenzsignal erzeugen"
      lead="Digitales Klappenbrett: ein Vollbild-Blitz und ein Ton-Burst werden exakt gleichzeitig ausgelöst und durch die Streaming-Pipeline geschickt. Nur die Gleichzeitigkeit an der Quelle zählt — synchrone Uhren sind nicht nötig."
      points={[
        'Vollbild-Canvas-Blitz + WebAudio-Tonburst, gleichzeitig',
        'Wiederholung alle ~2 s mit kodiertem Zähler (eindeutige Paarung)',
        'Läuft am Quellrechner oder auf einem zweiten Display',
        'Frequenz, Intervall und Helligkeit einstellbar',
      ]}
    />
  );
}
