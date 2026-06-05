import { useEffect, useState } from 'react';
import {
  VIDEO_PRESETS,
  SCALE_OPTIONS,
  getPreset,
  AUDIO_CODECS,
  AUDIO_BITRATES,
  audioCodecsForContainer,
  usesAudioBitrate,
  defaultBitrateKbps,
} from '@shared/presets';
import type { EncoderSupport, MediaInfo, RateControl, VideoConvertSpec } from '@shared/types';
import { Button } from '@jm/ui';
import { Card } from '@jm/ui';
import { DropZone } from '@/components/DropZone';
import { Select } from '@/components/Select';
import { JobCard } from '@/components/JobCard';
import { PreviewModal } from '@/components/PreviewModal';
import { useJobs } from '@/store/jobs';
import { basename, formatBytes, formatDuration, parseDuration } from '@/lib/format';
import { cn } from '@jm/ui';

interface Staged {
  path: string;
  name: string;
  info?: MediaInfo;
  probing: boolean;
  error?: string;
  trimStartStr: string;
  trimEndStr: string;
}

/** Resolve a staged item's trim range + validity from its text fields. */
function trimOf(s: Staged): { start: number; end: number; valid: boolean } {
  const dur = s.info?.durationSec ?? 0;
  const start = parseDuration(s.trimStartStr) ?? 0;
  const parsedEnd = parseDuration(s.trimEndStr);
  const end = parsedEnd == null ? dur : parsedEnd;
  const valid = dur <= 0 ? true : start >= 0 && end > start && end <= dur + 0.5;
  return { start, end, valid };
}

const HW_LABEL: Record<string, string> = {
  nvenc: 'NVENC',
  qsv: 'QuickSync',
  videotoolbox: 'VideoToolbox',
  vaapi: 'VAAPI',
};

const RATE_OPTIONS: { label: string; value: RateControl }[] = [
  { label: 'Qualität (CRF)', value: 'quality' },
  { label: 'VBR (Ziel-Bitrate)', value: 'vbr' },
  { label: 'CBR (konstant)', value: 'cbr' },
];

export function VideoView() {
  const jobs = useJobs((s) => s.jobs).filter((j) => j.kind === 'video');
  const addJob = useJobs((s) => s.add);
  const clearFinished = useJobs((s) => s.clearFinished);

  const [staged, setStaged] = useState<Staged[]>([]);
  const [presetId, setPresetId] = useState(VIDEO_PRESETS[0].id);
  const [scaleHeight, setScaleHeight] = useState<number | null>(null);
  const [rateControl, setRateControl] = useState<RateControl>('quality');
  const [quality, setQuality] = useState<number>(VIDEO_PRESETS[0].defaultQuality ?? 20);
  const [bitrateKbps, setBitrateKbps] = useState<number>(defaultBitrateKbps(null));
  const [audioCodec, setAudioCodec] = useState('aac');
  const [audioBitrateKbps, setAudioBitrateKbps] = useState(192);
  const [useHardware, setUseHardware] = useState(false);
  const [outputDir, setOutputDir] = useState<string | null>(null);
  const [encoders, setEncoders] = useState<EncoderSupport | null>(null);
  const [previewFile, setPreviewFile] = useState<Staged | null>(null);

  const preset = getPreset(presetId)!;
  const hwAvailable = Boolean(encoders?.hwKind);
  const rateControllable = preset.qualityKind === 'crf';
  const validAudio = audioCodecsForContainer(preset.container);

  useEffect(() => {
    void window.jmc.encoders.get().then((e) => {
      setEncoders(e);
      setUseHardware(Boolean(e.hwKind));
    });
  }, []);

  // Keep settings valid when the preset (and thus container) changes.
  useEffect(() => {
    if (preset.qualityKind === 'crf') {
      const [lo, hi] = preset.qualityRange ?? [14, 32];
      const def = preset.defaultQuality ?? 20;
      setQuality((q) => (q < lo || q > hi ? def : q));
    }
    const valid = audioCodecsForContainer(preset.container);
    setAudioCodec((c) => (valid.includes(c) ? c : valid[0]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetId]);

  async function addFiles(paths: string[]): Promise<void> {
    const fresh = paths.filter((p) => !staged.some((s) => s.path === p));
    if (!fresh.length) return;
    setStaged((prev) => [
      ...prev,
      ...fresh.map((p) => ({
        path: p,
        name: basename(p).replace(/\.[^.]+$/, ''),
        probing: true,
        trimStartStr: '0:00',
        trimEndStr: '',
      })),
    ]);
    for (const p of fresh) {
      try {
        const info = await window.jmc.media.probe(p);
        setStaged((prev) =>
          prev.map((s) =>
            s.path === p
              ? { ...s, info, probing: false, trimEndStr: s.trimEndStr || formatDuration(info.durationSec) }
              : s,
          ),
        );
      } catch {
        setStaged((prev) =>
          prev.map((s) => (s.path === p ? { ...s, probing: false, error: 'Datei konnte nicht gelesen werden' } : s)),
        );
      }
    }
  }

  async function pick(): Promise<void> {
    const paths = await window.jmc.dialog.pickFiles('video');
    if (paths.length) void addFiles(paths);
  }

  async function pickOutput(): Promise<void> {
    const dir = await window.jmc.dialog.pickDir();
    if (dir) setOutputDir(dir);
  }

  function specFor(s: Staged, jobId: string): VideoConvertSpec {
    const dur = s.info?.durationSec ?? 0;
    const { start, end } = trimOf(s);
    return {
      jobId,
      inputPath: s.path,
      outputDir: outputDir!,
      outputName: s.name,
      presetId,
      scaleHeight,
      rateControl: rateControllable ? rateControl : 'quality',
      quality: rateControllable && rateControl === 'quality' ? quality : null,
      bitrateKbps: rateControllable && rateControl !== 'quality' ? bitrateKbps : null,
      audioCodec,
      audioBitrateKbps: usesAudioBitrate(audioCodec) ? audioBitrateKbps : null,
      trimStartSec: start > 0 ? start : undefined,
      trimEndSec: dur > 0 && end < dur - 0.01 ? end : undefined,
      useHardware: useHardware && hwAvailable,
      durationSec: dur,
    };
  }

  function start(): void {
    if (!outputDir) return;
    const ready = staged.filter((s) => s.info && !s.error && trimOf(s).valid);
    for (const s of ready) {
      const jobId = crypto.randomUUID();
      addJob({
        id: jobId,
        kind: 'video',
        status: 'queued',
        inputPath: s.path,
        fileName: `${s.name}.${preset.container}`,
        presetLabel: preset.label,
        percent: 0,
      });
      void window.jmc.video.enqueue(specFor(s, jobId));
    }
    setStaged([]);
  }

  const readyCount = staged.filter((s) => s.info && !s.error && trimOf(s).valid).length;
  const canConvert = Boolean(outputDir) && readyCount > 0;
  const [lo, hi] = preset.qualityRange ?? [14, 32];

  return (
    <div className="space-y-6">
      {encoders && encoders.available.length === 0 && (
        <Card className="p-4 border-[var(--destructive)]/50">
          <p className="text-sm font-bold text-[var(--destructive)]">FFmpeg nicht gefunden</p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Die Videokonvertierung benötigt FFmpeg. Es wurde weder eine gebündelte Binary noch ein
            FFmpeg im System-PATH gefunden.
          </p>
        </Card>
      )}

      <DropZone hint="Videodateien hierher ziehen oder auswählen" onFiles={addFiles} onPick={pick} />

      {staged.length > 0 && (
        <div className="space-y-2">
          {staged.map((s) => (
            <div
              key={s.path}
              className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex flex-1 items-center gap-1 min-w-0">
                  <input
                    value={s.name}
                    onChange={(e) =>
                      setStaged((prev) => prev.map((x) => (x.path === s.path ? { ...x, name: e.target.value } : x)))
                    }
                    spellCheck={false}
                    className="min-w-0 flex-1 h-9 px-2 rounded-[var(--radius)] bg-[var(--input)] border border-[var(--border)] text-sm focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
                  />
                  <span className="shrink-0 text-xs text-[var(--muted-foreground)]">.{preset.container}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!s.info || Boolean(s.error)}
                  onClick={() => setPreviewFile(s)}
                >
                  Vorschau
                </Button>
                <button
                  type="button"
                  onClick={() => setStaged((prev) => prev.filter((x) => x.path !== s.path))}
                  className="shrink-0 text-[11px] uppercase tracking-wide font-extrabold text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                >
                  Entfernen
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-[var(--muted-foreground)] tabular">
                {s.probing
                  ? 'Wird gelesen…'
                  : s.error
                    ? s.error
                    : s.info
                      ? [
                          s.info.video ? `${s.info.video.width}×${s.info.video.height}` : null,
                          s.info.video?.codec,
                          formatDuration(s.info.durationSec),
                          formatBytes(s.info.sizeBytes),
                        ]
                          .filter(Boolean)
                          .join(' · ')
                      : ''}
              </p>

              {s.info && !s.error && (() => {
                const { start, end, valid } = trimOf(s);
                return (
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px]">
                    <span className="uppercase tracking-[0.1em] font-semibold text-[var(--muted-foreground)]">
                      Beschneiden
                    </span>
                    <label className="flex items-center gap-1.5">
                      <span className="text-[var(--muted-foreground)]">Start</span>
                      <TimeInput
                        value={s.trimStartStr}
                        onChange={(v) =>
                          setStaged((prev) => prev.map((x) => (x.path === s.path ? { ...x, trimStartStr: v } : x)))
                        }
                      />
                    </label>
                    <label className="flex items-center gap-1.5">
                      <span className="text-[var(--muted-foreground)]">Ende</span>
                      <TimeInput
                        value={s.trimEndStr}
                        onChange={(v) =>
                          setStaged((prev) => prev.map((x) => (x.path === s.path ? { ...x, trimEndStr: v } : x)))
                        }
                      />
                    </label>
                    {valid ? (
                      <span className="text-[var(--muted-foreground)] tabular">
                        → Dauer {formatDuration(end - start)}
                      </span>
                    ) : (
                      <span className="text-[var(--destructive)] font-bold">
                        Ungültiger Bereich (Ende muss nach Start und innerhalb der Länge liegen)
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      )}

      <Card className="p-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Select
            label="Format / Codec"
            value={presetId}
            onChange={(e) => setPresetId(e.target.value)}
            options={VIDEO_PRESETS.map((p) => ({ label: p.label, value: p.id }))}
          />
          <Select
            label="Auflösung"
            value={scaleHeight == null ? 'orig' : String(scaleHeight)}
            onChange={(e) => setScaleHeight(e.target.value === 'orig' ? null : Number(e.target.value))}
            options={SCALE_OPTIONS.map((o) => ({
              label: o.label,
              value: o.value == null ? 'orig' : String(o.value),
            }))}
          />

          {rateControllable ? (
            <>
              <Select
                label="Ratensteuerung"
                value={rateControl}
                onChange={(e) => setRateControl(e.target.value as RateControl)}
                options={RATE_OPTIONS}
              />
              {rateControl === 'quality' ? (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] uppercase tracking-[0.12em] font-semibold text-[var(--muted-foreground)]">
                    Qualität (CRF {quality}) · niedriger = besser
                  </span>
                  <input
                    type="range"
                    min={lo}
                    max={hi}
                    step={1}
                    value={quality}
                    onChange={(e) => setQuality(Number(e.target.value))}
                    className="h-10 accent-[var(--primary)]"
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] uppercase tracking-[0.12em] font-semibold text-[var(--muted-foreground)]">
                    Ziel-Bitrate (Mbit/s)
                  </span>
                  <input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={(bitrateKbps / 1000).toString()}
                    onChange={(e) => setBitrateKbps(Math.max(100, Math.round(Number(e.target.value) * 1000)))}
                    className="h-10 px-3 rounded-[var(--radius)] bg-[var(--input)] border border-[var(--border)] text-sm focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
                  />
                </div>
              )}
            </>
          ) : (
            <div className="md:col-span-2 text-xs text-[var(--muted-foreground)]">
              Qualität ist bei {preset.label} durch das Profil festgelegt (kein CRF/Bitrate).
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-[var(--border)]/60 pt-5">
          <Select
            label="Audio-Codec"
            value={audioCodec}
            onChange={(e) => setAudioCodec(e.target.value)}
            options={validAudio.map((id) => ({
              label: AUDIO_CODECS.find((c) => c.id === id)?.label ?? id,
              value: id,
            }))}
          />
          {usesAudioBitrate(audioCodec) ? (
            <Select
              label="Audio-Bitrate"
              value={String(audioBitrateKbps)}
              onChange={(e) => setAudioBitrateKbps(Number(e.target.value))}
              options={AUDIO_BITRATES.map((b) => ({ label: `${b} kbit/s`, value: String(b) }))}
            />
          ) : (
            <div className="flex items-end text-xs text-[var(--muted-foreground)]">
              {audioCodec === 'none'
                ? 'Kein Tonspur wird geschrieben.'
                : audioCodec === 'copy'
                  ? 'Originale Tonspur wird unverändert übernommen.'
                  : 'Verlustfreies Audio – keine Bitrate nötig.'}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--border)]/60 pt-4">
          <Toggle
            checked={useHardware && hwAvailable}
            onChange={setUseHardware}
            disabled={!hwAvailable}
            label={
              hwAvailable
                ? `Hardware-Beschleunigung (${HW_LABEL[encoders!.hwKind!] ?? encoders!.hwKind})`
                : 'Hardware-Beschleunigung (nicht verfügbar)'
            }
          />
        </div>

        <p className="text-xs text-[var(--muted-foreground)]">{preset.description}</p>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)]/60 pt-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="outline" size="sm" onClick={pickOutput}>
              Zielordner
            </Button>
            <span className="truncate text-xs text-[var(--muted-foreground)]">
              {outputDir ?? 'Kein Zielordner gewählt'}
            </span>
          </div>
          <Button onClick={start} disabled={!canConvert}>
            Konvertieren{readyCount > 0 ? ` (${readyCount})` : ''}
          </Button>
        </div>
      </Card>

      {jobs.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
              Aufträge
            </h2>
            <button
              type="button"
              onClick={clearFinished}
              className="text-[11px] uppercase tracking-wide font-extrabold text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              Erledigte entfernen
            </button>
          </div>
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}

      {previewFile && previewFile.info && (
        <PreviewModal
          fileName={`${previewFile.name}.${preset.container}`}
          baseReq={{
            inputPath: previewFile.path,
            durationSec: previewFile.info.durationSec,
            presetId,
            scaleHeight,
            rateControl: rateControllable ? rateControl : 'quality',
            quality: rateControllable && rateControl === 'quality' ? quality : null,
            bitrateKbps: rateControllable && rateControl !== 'quality' ? bitrateKbps : null,
            useHardware: useHardware && hwAvailable,
          }}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>
  );
}

function TimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="0:00"
      spellCheck={false}
      className="w-20 h-8 px-2 rounded-[var(--radius)] bg-[var(--input)] border border-[var(--border)] text-[12px] tabular text-center focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
    />
  );
}

function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn('flex items-center gap-2 text-sm', disabled && 'opacity-40')}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[var(--primary)]"
      />
      <span>{label}</span>
    </label>
  );
}
