import { useCallback, useEffect, useRef, useState } from 'react';
import { Card } from '@jm/ui';
import { Button } from '@jm/ui';
import { OffsetReadout } from '@/components/OffsetReadout';
import { SyncMeter, type SyncMeterUpdate } from '@/core/sync-meter';
import {
  listDevices,
  getUserStream,
  getDisplayStream,
  stopStream,
  type DeviceLists,
} from '@/core/sources';
import { runtime } from '@/platform';
import { cn } from '@jm/ui';

type Phase = 'idle' | 'running';
const EMPTY: SyncMeterUpdate = { stats: null, samples: [] };

export function MeasureView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const meterRef = useRef<SyncMeter | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [phase, setPhase] = useState<Phase>('idle');
  const [devices, setDevices] = useState<DeviceLists>({ video: [], audio: [] });
  const [videoId, setVideoId] = useState('');
  const [audioId, setAudioId] = useState('');
  const [update, setUpdate] = useState<SyncMeterUpdate>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const loadDevices = useCallback(async () => {
    setError(null);
    try {
      const probe = await getUserStream(); // prompt → unlocks device labels
      stopStream(probe);
      const list = await listDevices();
      setDevices(list);
      setVideoId((v) => v || list.video[0]?.deviceId || '');
      setAudioId((a) => a || list.audio[0]?.deviceId || '');
    } catch (e) {
      setError(friendly(e));
    }
  }, []);

  const start = useCallback(
    async (display = false) => {
      if (!videoRef.current) return;
      setError(null);
      try {
        const stream = display ? await getDisplayStream() : await getUserStream(videoId, audioId);
        streamRef.current = stream;
        const meter = new SyncMeter(videoRef.current, setUpdate);
        meterRef.current = meter;
        await meter.start(stream);
        setUpdate(EMPTY);
        setPhase('running');
      } catch (e) {
        stopStream(streamRef.current);
        streamRef.current = null;
        meterRef.current = null;
        setError(friendly(e));
      }
    },
    [videoId, audioId],
  );

  const stop = useCallback(() => {
    meterRef.current?.stop();
    stopStream(streamRef.current);
    meterRef.current = null;
    streamRef.current = null;
    setPhase('idle');
  }, []);

  // Clean up on unmount.
  useEffect(() => stop, [stop]);

  return (
    <div className="h-full flex flex-col gap-5">
      {phase === 'running' ? (
        <RunningPanel
          videoRef={videoRef}
          update={update}
          onStop={stop}
          onReset={() => {
            meterRef.current?.reset();
            setUpdate(EMPTY);
          }}
        />
      ) : (
        <SetupPanel
          videoRef={videoRef}
          devices={devices}
          videoId={videoId}
          audioId={audioId}
          onVideo={setVideoId}
          onAudio={setAudioId}
          onLoadDevices={loadDevices}
          onStart={() => start(false)}
          onStartDisplay={() => start(true)}
        />
      )}

      {error && (
        <Card variant="nested" className="px-4 py-3 text-sm text-[var(--destructive)]">
          {error}
        </Card>
      )}
    </div>
  );
}

function SetupPanel({
  videoRef,
  devices,
  videoId,
  audioId,
  onVideo,
  onAudio,
  onLoadDevices,
  onStart,
  onStartDisplay,
}: {
  videoRef: React.RefObject<HTMLVideoElement>;
  devices: DeviceLists;
  videoId: string;
  audioId: string;
  onVideo: (id: string) => void;
  onAudio: (id: string) => void;
  onLoadDevices: () => void;
  onStart: () => void;
  onStartDisplay: () => void;
}) {
  const hasDevices = devices.video.length > 0 || devices.audio.length > 0;
  return (
    <Card className="p-7">
      <span className="inline-block text-[10px] uppercase tracking-[0.14em] font-extrabold text-[var(--primary)]">
        Messung
      </span>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight">Versatz messen</h1>
      <p className="mt-2 text-sm text-[var(--muted-foreground)] leading-relaxed max-w-2xl">
        {runtime === 'web'
          ? 'Handy-Kamera auf den Screen, Mikro Richtung Lautsprecher. Generator (Blitz + Piep) muss durch die Pipeline laufen — die gemessene Differenz ist der A/V-Versatz.'
          : 'Capture-Card als Kamera, Audio-Interface als Mikrofon wählen. Der Generator-Blitz + Piep läuft durch die Pipeline; die gemessene Differenz ist der A/V-Versatz.'}
      </p>

      <div className="mt-6">
        <Button variant="outline" size="sm" onClick={onLoadDevices}>
          Zugriff erlauben &amp; Geräte laden
        </Button>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 max-w-2xl">
        <Field label="Videoquelle">
          <NativeSelect
            value={videoId}
            onChange={onVideo}
            options={devices.video}
            placeholder={hasDevices ? 'Videoquelle wählen' : 'Erst Geräte laden'}
          />
        </Field>
        <Field label="Audioquelle">
          <NativeSelect
            value={audioId}
            onChange={onAudio}
            options={devices.audio}
            placeholder={hasDevices ? 'Audioquelle wählen' : 'Erst Geräte laden'}
          />
        </Field>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button onClick={onStart}>Messung starten</Button>
        {runtime === 'electron' && (
          <Button variant="ghost" onClick={onStartDisplay} uppercase={false}>
            Bildschirm/Tab als Quelle (Quick-Check)
          </Button>
        )}
      </div>

      {/* Hidden video sink so the detector has frames even before "running". */}
      <video ref={videoRef} className="hidden" muted playsInline />
    </Card>
  );
}

function RunningPanel({
  videoRef,
  update,
  onStop,
  onReset,
}: {
  videoRef: React.RefObject<HTMLVideoElement>;
  update: SyncMeterUpdate;
  onStop: () => void;
  onReset: () => void;
}) {
  const recent = update.samples.slice(-8).reverse();
  return (
    <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr] items-start">
      <Card className="p-7">
        <OffsetReadout stats={update.stats} />
        <div className="mt-6 flex gap-3">
          <Button variant="destructive" onClick={onStop}>
            Stoppen
          </Button>
          <Button variant="outline" onClick={onReset}>
            Zurücksetzen
          </Button>
        </div>
      </Card>

      <Card variant="nested" className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-[0.12em] font-bold text-[var(--muted-foreground)]">
            Vorschau
          </span>
          <span className="text-xs text-[var(--muted-foreground)]">
            {update.samples.length} Zyklen
          </span>
        </div>
        <video
          ref={videoRef}
          className="mt-3 w-full rounded-[var(--radius)] bg-black aspect-video object-contain"
          muted
          playsInline
        />
        <ul className="mt-4 space-y-1.5 tabular">
          {recent.length === 0 && (
            <li className="text-sm text-[var(--muted-foreground)]">Warte auf Blitz + Piep…</li>
          )}
          {recent.map((s) => (
            <li key={s.cycle} className="flex justify-between text-sm">
              <span className="text-[var(--muted-foreground)]">#{s.cycle + 1}</span>
              <span className={cn(s.offsetMs >= 0 ? 'text-[var(--primary)]' : 'text-[var(--foreground)]')}>
                {s.offsetMs >= 0 ? '+' : ''}
                {s.offsetMs.toFixed(1)} ms
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs uppercase tracking-[0.12em] font-bold text-[var(--muted-foreground)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function NativeSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (id: string) => void;
  options: { deviceId: string; label: string }[];
  placeholder: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={options.length === 0}
      className={cn(
        'h-10 px-3 rounded-[var(--radius)] text-sm',
        'border border-[var(--border)] bg-[var(--input)] text-[var(--foreground)]',
        'disabled:opacity-50',
      )}
    >
      {options.length === 0 && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.deviceId} value={o.deviceId}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function friendly(e: unknown): string {
  const name = e instanceof DOMException ? e.name : '';
  const msg = e instanceof Error ? e.message : String(e);
  if (/Permission|NotAllowed/i.test(name + msg)) return 'Zugriff auf Kamera/Mikrofon verweigert.';
  if (/NotFound|Requested device/i.test(name + msg)) return 'Gewähltes Gerät nicht gefunden.';
  // NotReadableError → "Could not start video source": Gerät existiert, lässt
  // sich aber nicht öffnen (von anderer App belegt oder Treiber-/Zugriffsfehler).
  if (/NotReadable|Could not start|TrackStart/i.test(name + msg))
    return 'Videoquelle ließ sich nicht starten — wird sie evtl. schon von einer anderen App (OBS, Teams, …) benutzt? Andere Programme schließen und erneut versuchen.';
  if (/Overconstrained|NotSupported/i.test(name + msg))
    return 'Gewähltes Gerät unterstützt die angeforderten Einstellungen nicht. Anderes Gerät wählen.';
  return msg;
}
