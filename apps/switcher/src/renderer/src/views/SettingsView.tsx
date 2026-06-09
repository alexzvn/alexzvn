import { useEffect, useState } from 'react';
import { useSettings } from '@/store/settings';
import type { ControlStatus } from '@shared/types';

export function SettingsView() {
  const {
    rtmpUrl,
    streamBitrateKbps,
    controlEnabled,
    controlPort,
    setRtmpUrl,
    setStreamBitrateKbps,
    setControlEnabled,
    setControlPort,
  } = useSettings();

  const [ctrl, setCtrl] = useState<ControlStatus>({ running: false, port: controlPort, clients: 0 });
  useEffect(() => {
    void window.jmswitch.control.getStatus().then(setCtrl);
    return window.jmswitch.control.onStatus(setCtrl);
  }, []);

  return (
    <div className="h-full overflow-auto scroll-thin px-6 py-8">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Einstellungen</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Stream-Ziel und Qualität. Aufnahme &amp; Stream startest du in der Mischer-Ansicht.
          </p>
        </div>

        <section className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)] p-5 flex flex-col gap-5">
          <h2 className="text-[11px] uppercase tracking-[0.14em] font-extrabold text-[var(--muted-foreground)]">
            Streaming (RTMP)
          </h2>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold">RTMP-Ziel</span>
            <input
              type="text"
              value={rtmpUrl}
              onChange={(e) => setRtmpUrl(e.target.value)}
              placeholder="rtmp://server/app/streamkey"
              className="h-10 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm text-[var(--foreground)]"
            />
            <span className="text-[11px] text-[var(--muted-foreground)]">
              Vollständige URL inkl. Streamkey (z. B. YouTube-/Twitch-Ingest oder lokaler nginx-rtmp).
            </span>
          </label>

          <label className="flex flex-col gap-1.5 max-w-xs">
            <span className="text-sm font-bold">Stream-Bitrate</span>
            <span className="flex items-center gap-2">
              <input
                type="number"
                min={500}
                max={20000}
                step={250}
                value={streamBitrateKbps}
                onChange={(e) => setStreamBitrateKbps(Number(e.target.value))}
                className="h-10 w-32 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm text-center tabular text-[var(--foreground)]"
              />
              <span className="text-sm text-[var(--muted-foreground)]">kbit/s</span>
            </span>
            <span className="text-[11px] text-[var(--muted-foreground)]">
              Video-Bitrate des H.264-Streams (x264). 720p: ~3000–6000 kbit/s.
            </span>
          </label>

          <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed border-t border-[var(--border)]/60 pt-4">
            Auflösung: <span className="font-semibold text-[var(--foreground)]">1280×720 @ 30 fps</span> ·
            Ton: stille AAC-Spur (Audio-Mix kommt in v0.2). Der Stream wird aus dem Program-Bild
            kodiert (libx264, zerolatency).
          </p>
        </section>

        <section className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)] p-5 flex flex-col gap-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-[11px] uppercase tracking-[0.14em] font-extrabold text-[var(--muted-foreground)]">
              Fernsteuerung (Bitfocus Companion)
            </h2>
            <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide">
              <span
                className="size-2 rounded-full"
                style={{ background: ctrl.running ? 'var(--success)' : 'var(--muted-foreground)' }}
              />
              {ctrl.running ? `aktiv · Port ${ctrl.port} · ${ctrl.clients} Client(s)` : 'aus'}
            </span>
          </div>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={controlEnabled}
              onChange={(e) => setControlEnabled(e.target.checked)}
              className="size-4 accent-[var(--primary)]"
            />
            <span className="text-sm font-bold">TCP-Steuerserver aktivieren</span>
          </label>

          <label className="flex flex-col gap-1.5 max-w-xs">
            <span className="text-sm font-bold">Port</span>
            <input
              type="number"
              min={1}
              max={65535}
              value={controlPort}
              onChange={(e) => setControlPort(Number(e.target.value))}
              className="h-10 w-32 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm text-center tabular text-[var(--foreground)]"
            />
          </label>

          <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed border-t border-[var(--border)]/60 pt-4">
            Zeilenprotokoll (PREVIEW/PROGRAM/CUT/AUTO/RECORD/STREAM) für ein Stream-Deck via
            Bitfocus Companion — Modul: <span className="font-semibold text-[var(--foreground)]">packages/companion-jm-switcher</span>.
            Im Companion-Modul Host (IP dieses Rechners) + Port eintragen.
          </p>
        </section>

        <section className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)] p-5 flex flex-col gap-3">
          <h2 className="text-[11px] uppercase tracking-[0.14em] font-extrabold text-[var(--muted-foreground)]">
            Aufnahme
          </h2>
          <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed">
            Aufnahmen werden als <span className="font-semibold text-[var(--foreground)]">WebM</span>{' '}
            gespeichert (Speicherort wird beim Start abgefragt). Für MP4 die Datei im
            <span className="font-semibold text-[var(--foreground)]"> JM Media Converter</span> umwandeln.
          </p>
        </section>
      </div>
    </div>
  );
}
