# Mess-Engine (framework-neutral)

Hier lebt der plattformunabhängige Kern (kein React, kein Electron), damit ihn
sowohl die Electron-Hülle als auch der PWA-Build teilen. Geplante Module:

- `generator.ts` — Blitz + Piep gleichzeitig auslösen, mit kodiertem Zähler-Pattern.
- `video-flash.ts` — `requestVideoFrameCallback` → ROI-Luminanz-Anstiegsflanke → Zeitstempel.
- `audio-onset.ts` — `AudioWorklet` → Matched-Filter-Onset → sample-genauer Zeitstempel.
- `correlator.ts` — Blitz-/Piep-Events paaren, Δ berechnen, robuste Statistik (Median + MAD).
- `calibration.ts` — Null-Abgleich (Loopback-Baseline), wird von Messungen subtrahiert.

Domänentypen liegen in [`@shared/types`](../../../shared/types.ts)
(`SyncSample`, `MeasurementStats`, `Calibration`, `SourceKind`).
