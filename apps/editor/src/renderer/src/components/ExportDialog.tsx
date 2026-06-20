import { cn } from '@jm/ui';
import { AUDIO_CODECS, SEQUENCE_PRESETS, VIDEO_PRESETS, usesAudioBitrate } from '@shared/presets';
import type { RateControl } from '@shared/project';
import { useProject } from '@/store/project';
import { cancelExportFlow, startExportFlow } from '@/lib/actions';

const inputCls = 'w-full h-9 px-2 rounded-[var(--radius)] bg-[var(--background)] border border-[var(--border)] text-sm';

export function ExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ex = useProject((s) => s.present.export);
  const patchProject = useProject((s) => s.patchProject);
  const status = useProject((s) => s.exportStatus);

  if (!open) return null;

  const setEx = (patch: Partial<typeof ex>): void => patchProject((draft) => Object.assign(draft.export, patch));
  const sequenceValue = `${ex.width}x${ex.height}@${ex.fps}`;
  const preset = VIDEO_PRESETS.find((p) => p.id === ex.presetId) ?? VIDEO_PRESETS[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-[520px] max-h-[88vh] overflow-auto rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-extrabold uppercase tracking-wide">Exportieren</h2>
          <button type="button" onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <Field label="Format / Codec">
            <select className={inputCls} value={ex.presetId} onChange={(e) => setEx({ presetId: e.target.value })}>
              {VIDEO_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">{preset.description}</p>
          </Field>

          <Field label="Sequenz (Auflösung · Framerate)">
            <select
              className={inputCls}
              value={sequenceValue}
              onChange={(e) => {
                const sp = SEQUENCE_PRESETS.find((s) => `${s.width}x${s.height}@${s.fps}` === e.target.value);
                if (sp) setEx({ width: sp.width, height: sp.height, fps: sp.fps });
              }}
            >
              {SEQUENCE_PRESETS.map((s) => (
                <option key={`${s.width}x${s.height}@${s.fps}`} value={`${s.width}x${s.height}@${s.fps}`}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>

          {preset.qualityKind === 'crf' && (
            <Field label="Ratensteuerung">
              <div className="flex gap-2">
                <select
                  className={inputCls}
                  value={ex.rateControl}
                  onChange={(e) => setEx({ rateControl: e.target.value as RateControl })}
                >
                  <option value="quality">Qualität (CRF)</option>
                  <option value="vbr">Variable Bitrate</option>
                  <option value="cbr">Konstante Bitrate</option>
                </select>
                {ex.rateControl === 'quality' ? (
                  <input
                    type="number"
                    className={cn(inputCls, 'w-28')}
                    placeholder={String(preset.defaultQuality ?? 22)}
                    value={ex.quality ?? ''}
                    onChange={(e) => setEx({ quality: e.target.value ? Number(e.target.value) : null })}
                    title="CRF (niedriger = besser)"
                  />
                ) : (
                  <input
                    type="number"
                    className={cn(inputCls, 'w-28')}
                    placeholder="8000"
                    value={ex.bitrateKbps ?? ''}
                    onChange={(e) => setEx({ bitrateKbps: e.target.value ? Number(e.target.value) : null })}
                    title="kbps"
                  />
                )}
              </div>
            </Field>
          )}

          <Field label="Ton">
            <div className="flex gap-2">
              <select
                className={inputCls}
                value={ex.audioCodec}
                onChange={(e) => setEx({ audioCodec: e.target.value })}
              >
                {AUDIO_CODECS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
              {usesAudioBitrate(ex.audioCodec) && (
                <input
                  type="number"
                  className={cn(inputCls, 'w-28')}
                  value={ex.audioBitrateKbps ?? 192}
                  onChange={(e) => setEx({ audioBitrateKbps: Number(e.target.value) })}
                  title="Audio kbps"
                />
              )}
            </div>
          </Field>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={ex.useHardware} onChange={(e) => setEx({ useHardware: e.target.checked })} />
            Hardware-Encoder verwenden (falls verfügbar)
          </label>

          {status.running && (
            <div className="mt-2">
              <div className="h-2 rounded bg-[var(--background)] overflow-hidden border border-[var(--border)]">
                <div className="h-full bg-[var(--primary)] transition-[width]" style={{ width: `${Math.max(0, status.percent)}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                {Math.round(status.percent)} %{status.etaSec != null ? ` · noch ~${Math.round(status.etaSec)} s` : ''}
              </p>
            </div>
          )}
          {status.error && <p className="text-xs text-[var(--destructive)]">{status.error}</p>}
          {status.lastOutput && (
            <p className="text-xs text-emerald-400">
              Fertig:{' '}
              <button className="underline" onClick={() => window.jmed.shell.reveal(status.lastOutput!)}>
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
