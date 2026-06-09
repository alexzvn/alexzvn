import { useSettings } from '@/store/settings';

export function SettingsView() {
  const { rtmpUrl, streamBitrateKbps, setRtmpUrl, setStreamBitrateKbps } = useSettings();

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
