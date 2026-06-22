import { cn } from '@jm/ui';
import type { AudioExportFormat } from '@shared/project';
import { useProject } from '@/store/project';
import { cancelExportFlow, startExportFlow } from '@/lib/actions';

const inputCls = 'w-full h-9 px-2 rounded-[var(--radius)] bg-[var(--background)] border border-[var(--border)] text-sm';

const FORMATS: { id: AudioExportFormat; label: string; lossy: boolean }[] = [
  { id: 'wav', label: 'WAV (unkomprimiert)', lossy: false },
  { id: 'flac', label: 'FLAC (verlustfrei)', lossy: false },
  { id: 'mp3', label: 'MP3', lossy: true },
  { id: 'aac', label: 'AAC (M4A)', lossy: true },
  { id: 'ogg', label: 'OGG Vorbis', lossy: true },
];

export function ExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ex = useProject((s) => s.present.export);
  const patchProject = useProject((s) => s.patchProject);
  const status = useProject((s) => s.exportStatus);

  if (!open) return null;

  const setEx = (patch: Partial<typeof ex>): void => patchProject((draft) => Object.assign(draft.export, patch));
  const fmt = FORMATS.find((f) => f.id === ex.format) ?? FORMATS[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-[460px] max-h-[88vh] overflow-auto rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-extrabold uppercase tracking-wide">Mix exportieren</h2>
          <button type="button" onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <Field label="Format">
            <select
              className={inputCls}
              value={ex.format}
              onChange={(e) => setEx({ format: e.target.value as AudioExportFormat })}
            >
              {FORMATS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </Field>

          {ex.format === 'wav' && (
            <Field label="Bittiefe">
              <select
                className={inputCls}
                value={ex.bitDepth ?? 24}
                onChange={(e) => setEx({ bitDepth: Number(e.target.value) as 16 | 24 | 32 })}
              >
                <option value={16}>16 Bit (PCM)</option>
                <option value={24}>24 Bit (PCM)</option>
                <option value={32}>32 Bit (Float)</option>
              </select>
            </Field>
          )}

          {fmt.lossy && (
            <Field label="Bitrate (kbps)">
              <input
                type="number"
                className={inputCls}
                value={ex.bitrateKbps ?? 256}
                min={64}
                max={512}
                step={32}
                onChange={(e) => setEx({ bitrateKbps: Number(e.target.value) || 256 })}
              />
            </Field>
          )}

          <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed">
            Der Mix wird offline mit {Math.round(ex.sampleRate / 1000)} kHz gerendert (Master-Pegel, Spur-Fader, Pan,
            Mute/Solo und Blenden inklusive) und anschließend ins Zielformat geschrieben.
          </p>

          {status.running && (
            <div className="mt-2">
              <div className="h-2 rounded bg-[var(--background)] overflow-hidden border border-[var(--border)]">
                <div className="h-full bg-[var(--primary)] transition-[width]" style={{ width: `${Math.max(0, status.percent)}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                {status.message ?? `${Math.round(status.percent)} %`}
              </p>
            </div>
          )}
          {status.error && <p className="text-xs text-[var(--destructive)]">{status.error}</p>}
          {status.lastOutput && (
            <p className="text-xs text-emerald-400">
              Fertig:{' '}
              <button className="underline" onClick={() => window.jmdaw.shell.reveal(status.lastOutput!)}>
                im Ordner anzeigen
              </button>
            </p>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          {status.running ? (
            <button
              type="button"
              onClick={cancelExportFlow}
              className="h-9 px-4 rounded-[var(--radius)] text-xs font-extrabold uppercase border border-[var(--border)] hover:bg-[var(--highlight)]"
            >
              Abbrechen
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void startExportFlow()}
              className="h-9 px-5 rounded-[var(--radius)] text-xs font-extrabold uppercase bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90"
            >
              Export starten
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">{label}</span>
      <div className="mt-1">{children}</div>
    </div>
  );
}
