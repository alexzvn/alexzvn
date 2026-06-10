import { useState } from 'react';
import { Button, cn, Logo } from '@jm/ui';
import {
  LANGUAGES,
  type Job,
  type ModelState,
  type OutputFormat,
  type TranscribeState,
} from '@shared/types';
import { useTranscribe } from '@/store/transcribe';

const FORMATS: { id: OutputFormat; label: string }[] = [
  { id: 'srt', label: 'SRT' },
  { id: 'vtt', label: 'VTT' },
  { id: 'txt', label: 'TXT' },
];

function fmtSize(mb: number): string {
  return mb >= 1000 ? `${(mb / 1000).toFixed(1)} GB` : `${mb} MB`;
}

const STATUS_LABEL: Record<Job['status'], string> = {
  queued: 'Wartet',
  preparing: 'Audio wird vorbereitet …',
  transcribing: 'Transkribiert …',
  done: 'Fertig',
  error: 'Fehler',
  canceled: 'Abgebrochen',
};

export function OperatorView(): React.JSX.Element {
  const state = useTranscribe((s) => s.state);
  const store = useTranscribe();
  const [dragOver, setDragOver] = useState(false);

  if (!state) {
    return <div className="h-screen grid place-items-center text-[var(--muted-foreground)]">Lädt…</div>;
  }

  const { config, jobs, models, engineReady } = state;
  const selectedModel = models.find((m) => m.id === config.model);
  const modelMissing = !selectedModel?.installed;
  const hasQueued = jobs.some((j) => j.status === 'queued');
  const busy = jobs.some((j) => j.status === 'preparing' || j.status === 'transcribing');
  const canStart = engineReady && hasQueued && !modelMissing;

  const onDrop = (e: React.DragEvent): void => {
    e.preventDefault();
    setDragOver(false);
    const paths = Array.from(e.dataTransfer.files)
      .map((f) => window.jmtranscribe.pathForFile(f))
      .filter(Boolean);
    if (paths.length) void store.addPaths(paths);
  };

  return (
    <div className="h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)]">
      <header className="h-14 shrink-0 flex items-center gap-3 px-6 border-b border-[var(--border)]/60">
        <Logo size={24} />
        <span className="text-sm font-extrabold tracking-[0.06em]">JM TRANSCRIBE</span>
        <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
          Lokale Untertitel · Whisper
        </span>
      </header>

      {!engineReady && (
        <div className="px-6 py-2 text-[12px] bg-[var(--accent)]/15 text-[var(--foreground)] border-b border-[var(--border)]/60">
          Transkriptions-Engine nicht gefunden — die App muss mit gebündelter whisper-Binary auf Windows gebaut werden.
          Bedienung/Einstellungen funktionieren, das Transkribieren erst mit Engine.
        </div>
      )}

      <div className="flex-1 min-h-0 flex">
        {/* Warteschlange */}
        <div className="flex-1 min-w-0 flex flex-col p-5 gap-3">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="primary" onClick={() => void store.addFiles()}>
              Dateien hinzufügen
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void store.clearFinished()}>
              Erledigte entfernen
            </Button>
            <span className="ml-auto text-[11px] text-[var(--muted-foreground)]">
              {jobs.length} {jobs.length === 1 ? 'Datei' : 'Dateien'}
            </span>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={cn(
              'flex-1 min-h-0 overflow-auto rounded-[var(--radius-lg)] border-2 border-dashed p-2',
              dragOver ? 'border-[var(--primary)] bg-[var(--primary)]/5' : 'border-[var(--border)]',
            )}
          >
            {jobs.length === 0 ? (
              <div className="h-full grid place-items-center text-center text-[var(--muted-foreground)] text-sm px-6">
                Audio-/Videodateien hierher ziehen<br />oder „Dateien hinzufügen".
              </div>
            ) : (
              <ul className="space-y-2">
                {jobs.map((j) => (
                  <JobRow
                    key={j.id}
                    job={j}
                    onRemove={() => void store.removeJob(j.id)}
                    onCancel={() => void store.cancel(j.id)}
                    onReveal={(p) => void window.jmtranscribe.revealOutput(p)}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Einstellungen + Modelle */}
        <div className="w-[380px] shrink-0 overflow-auto border-l border-[var(--border)]/60">
          <div className="p-5 space-y-5">
            <Section title="Einstellungen">
              <Labeled label="Modell">
                <select
                  value={config.model}
                  onChange={(e) => void store.setConfig({ model: e.target.value as typeof config.model })}
                  className="h-9 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-2 text-sm font-semibold"
                >
                  {models.map((m) => (
                    <option key={m.id} value={m.id} disabled={!m.installed}>
                      {m.label}
                      {m.installed ? '' : ' — nicht installiert'}
                    </option>
                  ))}
                </select>
              </Labeled>
              {modelMissing && (
                <p className="text-[11px] text-[var(--destructive)]">
                  Modell unten laden oder ein installiertes wählen.
                </p>
              )}

              <Labeled label="Sprache">
                <select
                  value={config.language}
                  onChange={(e) => void store.setConfig({ language: e.target.value as typeof config.language })}
                  className="h-9 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-2 text-sm font-semibold"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </Labeled>

              <div className="flex gap-2">
                {(['transcribe', 'translate'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => void store.setConfig({ task: t })}
                    className={cn(
                      'flex-1 h-9 rounded-[var(--radius)] text-xs font-bold border',
                      config.task === t
                        ? 'bg-[var(--accent)] text-[var(--foreground)] border-transparent'
                        : 'border-[var(--border)] hover:bg-[var(--highlight)]',
                    )}
                  >
                    {t === 'transcribe' ? 'Transkribieren' : 'Nach EN übersetzen'}
                  </button>
                ))}
              </div>

              <div>
                <div className="text-sm font-semibold mb-1">Formate</div>
                <div className="flex gap-4">
                  {FORMATS.map((f) => (
                    <label key={f.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.formats.includes(f.id)}
                        onChange={(e) => {
                          const set = new Set(config.formats);
                          if (e.target.checked) set.add(f.id);
                          else set.delete(f.id);
                          void store.setConfig({ formats: Array.from(set) });
                        }}
                      />
                      {f.label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold mb-1">Zielordner</div>
                <div className="flex items-center gap-2">
                  <span className="flex-1 truncate text-[12px] text-[var(--muted-foreground)]">
                    {config.outputDir ?? 'Neben der Quelldatei'}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => void store.chooseOutputDir()}>
                    Wählen
                  </Button>
                  {config.outputDir && (
                    <Button size="sm" variant="ghost" onClick={() => void store.setConfig({ outputDir: null })}>
                      ✕
                    </Button>
                  )}
                </div>
              </div>
            </Section>

            <Section title="Modelle">
              <div className="space-y-2">
                {models.map((m) => (
                  <ModelRow
                    key={m.id}
                    model={m}
                    onDownload={() => void store.downloadModel(m.id)}
                    onDelete={() => void store.deleteModel(m.id)}
                  />
                ))}
              </div>
              <p className="text-[11px] text-[var(--muted-foreground)]">
                Größere Modelle = bessere Qualität, langsamer. Base ist mitgeliefert.
              </p>
            </Section>

            <Button
              variant="primary"
              size="lg"
              className="w-full"
              disabled={!canStart || busy}
              onClick={() => void store.start()}
            >
              {busy ? 'Läuft …' : 'Transkribieren starten'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function JobRow({
  job,
  onRemove,
  onCancel,
  onReveal,
}: {
  job: Job;
  onRemove: () => void;
  onCancel: () => void;
  onReveal: (p: string) => void;
}): React.JSX.Element {
  const active = job.status === 'preparing' || job.status === 'transcribing';
  return (
    <li className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3">
      <div className="flex items-center gap-2">
        <span className="flex-1 truncate text-sm font-semibold">{job.fileName}</span>
        <span
          className={cn(
            'text-[10px] uppercase tracking-[0.1em] font-extrabold',
            job.status === 'done' && 'text-[var(--primary)]',
            job.status === 'error' && 'text-[var(--destructive)]',
            job.status === 'canceled' && 'text-[var(--muted-foreground)]',
          )}
        >
          {STATUS_LABEL[job.status]}
        </span>
        {active ? (
          <button onClick={onCancel} className="text-[11px] text-[var(--muted-foreground)] hover:text-[var(--destructive)]">
            Stopp
          </button>
        ) : (
          <button onClick={onRemove} className="text-[11px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
            ✕
          </button>
        )}
      </div>

      {job.status === 'transcribing' && (
        <div className="mt-2 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
          <div
            className="h-full bg-[var(--primary)] transition-[width] duration-300"
            style={{ width: `${Math.round(job.progress * 100)}%` }}
          />
        </div>
      )}
      {job.status === 'error' && job.error && (
        <p className="mt-1.5 text-[11px] text-[var(--destructive)]">{job.error}</p>
      )}
      {job.outputs.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {job.outputs.map((p) => (
            <button
              key={p}
              onClick={() => onReveal(p)}
              className="text-[11px] rounded px-2 py-0.5 border border-[var(--border)] hover:bg-[var(--highlight)] uppercase tabular"
              title={p}
            >
              {p.split(/[/\\]/).pop()}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}

function ModelRow({
  model,
  onDownload,
  onDelete,
}: {
  model: ModelState;
  onDownload: () => void;
  onDelete: () => void;
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--border)] px-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate">{model.label}</div>
        <div className="text-[11px] text-[var(--muted-foreground)] tabular">{fmtSize(model.sizeMB)}</div>
      </div>
      {model.downloading != null ? (
        <span className="text-[11px] tabular text-[var(--primary)]">{Math.round(model.downloading * 100)} %</span>
      ) : model.installed ? (
        <>
          <span className="text-[11px] text-[var(--primary)] font-bold">✓</span>
          {!model.bundled && (
            <button onClick={onDelete} className="text-[11px] text-[var(--muted-foreground)] hover:text-[var(--destructive)]">
              löschen
            </button>
          )}
        </>
      ) : (
        <Button size="sm" variant="ghost" onClick={onDownload}>
          Laden
        </Button>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section className="space-y-2.5">
      <h3 className="text-[10px] uppercase tracking-[0.14em] font-extrabold text-[var(--muted-foreground)]">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <label className="block">
      <div className="text-sm font-semibold mb-1">{label}</div>
      {children}
    </label>
  );
}
