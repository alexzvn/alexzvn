import { Placeholder } from '@/components/Placeholder';
import { runtime } from '@/platform';

export function MeasureView() {
  return (
    <Placeholder
      badge="Phase 1 · folgt"
      title="Versatz messen"
      lead={
        runtime === 'web'
          ? 'Handy-Kamera auf den Screen, Mikro Richtung Lautsprecher — beide Signale werden mit einer Uhr erfasst. Die gemessene Differenz Blitz↔Piep ist der A/V-Versatz der Pipeline.'
          : 'Capture-Card als Video- und Audio-Interface als Tonquelle wählen. Beide Signale werden mit einer Uhr erfasst; die Differenz Blitz↔Piep ist der A/V-Versatz der Pipeline.'
      }
      points={[
        'Quelle wählen (Kamera/Mikro bzw. Capture-Card/Audio-Interface)',
        'Blitz-Erkennung über requestVideoFrameCallback (Luminanz-Flanke)',
        'Piep-Erkennung über AudioWorklet (Matched-Filter-Onset)',
        'Robuster Median + Jitter über viele Zyklen, mit Vorzeichen',
        'Große Ablesung: „Audio X ms vor Video" + Verlaufsgraph',
      ]}
    />
  );
}
