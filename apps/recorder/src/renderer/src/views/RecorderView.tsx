import { Badge, Button, Card, cn } from '@jm/ui';
import { useRec } from '@/store/recorder';
import { basename, dbfsLabel, formatClock, meterColor, meterPct } from '@/lib/format';

export function RecorderView() {
  const loading = useRec((s) => s.loading);
  const devices = useRec((s) => s.devices);
  const deviceIndex = useRec((s) => s.deviceIndex);
  const channels = useRec((s) => s.channels);
  const sampleRate = useRec((s) => s.sampleRate);
  const dir = useRec((s) => s.dir);
  const fileName = useRec((s) => s.fileName);
  const state = useRec((s) => s.state);
  const peaks = useRec((s) => s.peaks);

  const selectDevice = useRec((s) => s.selectDevice);
  const setChannels = useRec((s) => s.setChannels);
  const setSampleRate = useRec((s) => s.setSampleRate);
  const setFileName = useRec((s) => s.setFileName);
  const pickDir = useRec((s) => s.pickDir);
  const refreshDevices = useRec((s) => s.refreshDevices);
  const arm = useRec((s) => s.arm);
  const disarm = useRec((s) => s.disarm);
  const record = useRec((s) => s.record);
  const stop = useRec((s) => s.stop);

  const selected = devices.find((d) => d.index === deviceIndex) ?? null;
  const status = state.status;
  const open = status !== 'idle';
  const recording = status === 'recording';
  const meterCount = open ? state.channels : channels;

  return (
    <div className="max-w-[1100px] mx-auto px-7 py-7 flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Aufnahme</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            {loading ? 'Suche Audiogeräte…' : `${devices.length} Eingänge`}
          </p>
        </div>
        <Button size="sm" variant="outline" disabled={open} onClick={() => void refreshDevices()}>
          Geräte aktualisieren
        </Button>
      </div>

      {/* Eingang */}
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-4 items-end">
          <Field label="Eingang">
            <select
              value={deviceIndex ?? ''}
              disabled={open || devices.length === 0}
              onChange={(e) => selectDevice(Number(e.target.value))}
              className="h-10 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm disabled:opacity-50"
            >
              {devices.length === 0 && <option value="">Kein Eingang gefunden</option>}
              {devices.map((d) => (
                <option key={d.index} value={d.index}>
                  {d.name} — {d.hostApiName} ({d.maxInputChannels} ch)
                </option>
              ))}
            </select>
          </Field>

          <Field label="Kanäle">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={selected?.maxInputChannels ?? 64}
                value={channels}
                disabled={open}
                onChange={(e) => setChannels(Number(e.target.value))}
                className="h-10 w-20 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm tabular disabled:opacity-50"
              />
              {selected && (
                <button
                  type="button"
                  disabled={open}
                  onClick={() => setChannels(selected.maxInputChannels)}
                  className="h-10 px-2.5 rounded-[var(--radius)] border border-[var(--border)] text-xs font-bold hover:bg-[var(--highlight)] disabled:opacity-50"
                  title={`Alle ${selected.maxInputChannels} Kanäle`}
                >
                  Max
                </button>
              )}
            </div>
          </Field>

          <Field label="Samplerate (Hz)">
            <input
              type="number"
              min={8000}
              step={100}
              value={sampleRate}
              disabled={open}
              onChange={(e) => setSampleRate(Number(e.target.value))}
              className="h-10 w-28 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm tabular disabled:opacity-50"
            />
          </Field>
        </div>

        {selected && /asio/i.test(selected.hostApiName) && (
          <p className="text-[11px] text-[var(--muted-foreground)] mt-3">
            ASIO: Samplerate muss exakt zur Geräte-Einstellung (z. B. DVSC) passen, sonst schlägt das Öffnen fehl.
          </p>
        )}
      </Card>

      {/* Transport */}
      <Card className="p-6">
        <div className="flex flex-wrap items-center gap-4">
          {!open ? (
            <Button variant="primary" disabled={deviceIndex == null} onClick={() => void arm()}>
              Eingang öffnen
            </Button>
          ) : recording ? (
            <button
              type="button"
              onClick={() => void stop()}
              className="inline-flex items-center gap-3 h-12 px-6 rounded-[var(--radius)] font-extrabold uppercase tracking-wide
                         bg-[var(--destructive)] text-[var(--destructive-foreground)] hover:opacity-90 transition-opacity"
            >
              <span className="size-3 rounded-[2px] bg-current" />
              Stopp
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void record()}
              className="inline-flex items-center gap-3 h-12 px-6 rounded-[var(--radius)] font-extrabold uppercase tracking-wide
                         bg-[var(--destructive)] text-[var(--destructive-foreground)] hover:opacity-90 transition-opacity"
            >
              <span className="size-3 rounded-full bg-current" />
              Aufnahme
            </button>
          )}

          {open && (
            <Button variant="outline" onClick={() => void disarm()}>
              Eingang schließen
            </Button>
          )}

          <div className="ml-auto flex items-center gap-4">
            <Badge tone={recording ? 'warning' : open ? 'success' : 'muted'}>
              {recording ? 'Aufnahme' : open ? 'Bereit' : 'Inaktiv'}
            </Badge>
            <span className="tabular text-2xl font-extrabold">{formatClock(state.recordedSec)}</span>
          </div>
        </div>

        {/* Ziel */}
        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-4 items-end mt-6">
          <Field label="Zielordner">
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => void pickDir()}>
                Ordner wählen…
              </Button>
              <span className="text-xs text-[var(--muted-foreground)] truncate max-w-[280px]">
                {dir ? dir : 'noch keiner gewählt'}
              </span>
            </div>
          </Field>
          <Field label="Dateiname (optional)">
            <input
              value={fileName}
              placeholder="leer = Zeitstempel"
              onChange={(e) => setFileName(e.target.value)}
              className="h-10 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm"
            />
          </Field>
        </div>

        {state.filePath && (
          <button
            type="button"
            onClick={() => window.jmrec.shell.reveal(state.filePath as string)}
            className="mt-3 text-[11px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] truncate block max-w-full"
            title="Im Ordner zeigen"
          >
            → {basename(state.filePath)}
          </button>
        )}
      </Card>

      {/* Pegelmeter */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-extrabold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
            Pegel
          </h2>
          {!open && <span className="text-xs text-[var(--muted-foreground)]">Eingang öffnen zum Messen</span>}
        </div>
        <div className={cn('flex flex-col gap-1.5', !open && 'opacity-40')}>
          {Array.from({ length: Math.max(meterCount, 1) }, (_, c) => {
            const peak = peaks[c] ?? 0;
            return (
              <div key={c} className="flex items-center gap-3">
                <span className="tabular text-[10px] font-bold text-[var(--muted-foreground)] w-9">
                  CH{String(c + 1).padStart(2, '0')}
                </span>
                <div className="flex-1 h-3 rounded-full bg-[var(--muted)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-[width] duration-75"
                    style={{ width: `${meterPct(peak)}%`, background: meterColor(peak) }}
                  />
                </div>
                <span className="tabular text-[10px] text-[var(--muted-foreground)] w-12 text-right">
                  {dbfsLabel(peak)} dB
                </span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] uppercase tracking-[0.12em] font-extrabold text-[var(--muted-foreground)]">
        {label}
      </span>
      {children}
    </label>
  );
}
