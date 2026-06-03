import { Placeholder } from '@/components/Placeholder';

export function CalibrateView() {
  return (
    <Placeholder
      badge="Phase 2 · folgt"
      title="Null-Abgleich"
      lead="Generator und Messung einmal direkt gegeneinander (ohne Pipeline) messen, um die systematische Eigenlatenz von Anzeige und Audio-Ausgabe zu bestimmen. Dieser Wert wird von jeder echten Messung abgezogen — der Schlüssel, um nah an die Hardware-Genauigkeit zu kommen."
      points={[
        'Loopback-Baseline gegen das eigene Setup erfassen',
        'Baseline + Zeitstempel speichern und auf Messungen anwenden',
        'Erinnerung, wenn die Quelle/Hardware gewechselt wurde',
      ]}
    />
  );
}
