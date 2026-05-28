import { useEffect, useState } from 'react';
import { VIDEO_PRESETS, SCALE_OPTIONS, getPreset } from '@shared/presets';
import type { EncoderSupport, MediaInfo, VideoConvertSpec } from '@shared/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DropZone } from '@/components/DropZone';
import { Select } from '@/components/Select';
import { JobCard } from '@/components/JobCard';
import { useJobs } from '@/store/jobs';
import { basename, formatBytes, formatDuration } from '@/lib/format';
import { cn } from '@/lib/cn';

interface Staged {
  path: string;
  info?: MediaInfo;
  probing: boolean;
  error?: string;
}

const HW_LABEL: Record<string, string> = {
  nvenc: 'NVENC',
  qsv: 'QuickSync',
  videotoolbox: 'VideoToolbox',
  vaapi: 'VAAPI',
};

export function VideoView() {
  const jobs = useJobs((s) => s.jobs).filter((j) => j.kind === 'video');
  const addJob = useJobs((s) => s.add);
  const clearFinished = useJobs((s) => s.clearFinished);

  const [staged, setStaged] = useState<Staged[]>([]);
  const [presetId, setPresetId] = useState(VIDEO_PRESETS[0].id);
  const [quality, setQuality] = useState<number>(VIDEO_PRESETS[0].defaultQuality ?? 20);
  const [scaleHeight, setScaleHeight] = useState<number | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [useHardware, setUseHardware] = useState(false);
  const [outputDir, setOutputDir] = useState<string | null>(null);
  const [encoders, setEncoders] = useState<EncoderSupport | null>(null);

  const preset = getPreset(presetId)!;
  const hwAvailable = Boolean(encoders?.hwKind);

  useEffect(() => {
    void window.jmc.encoders.get().then((e) => {
      setEncoders(e);
      setUseHardware(Boolean(e.hwKind));
    });
  }, []);

  useEffect(() => {
    if (preset.qualityKind === 'crf') {
      const [lo, hi] = preset.qualityRange ?? [14, 32];
      const def = preset.defaultQuality ?? 20;
      setQuality((q) => (q < lo || q > hi ? def : q));
    }
  }, [presetId]);

  async function addFiles(paths: string[]): Promise<void> {
    const fresh = paths.filter((p) => !staged.some((s) => s.path === p));
    if (!fresh.length) return;
    setStaged((prev) => [...prev, ...fresh.map((p) => ({ path: p, probing: true }))]);
    for (const p of fresh) {
      try {
        const info = await window.jmc.media.probe(p);
        setStaged((prev) => prev.map((s) => (s.path === p ? { ...s, info, probing: false } : s)));
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

  function start(): void {
    if (!outputDir) return;
    const ready = staged.filter((s) => s.info && !s.error);
    for (const s of ready) {
      const jobId = crypto.randomUUID();
      const spec: VideoConvertSpec = {
        jobId,
        inputPath: s.path,
        outputDir,
        presetId,
        scaleHeight,
        quality: preset.qualityKind === 'crf' ? quality : null,
        audioEnabled,
        useHardware: useHardware && hwAvailable,
        durationSec: s.info?.durationSec ?? 0,
      };
      addJob({
        id: jobId,
        kind: 'video',
        status: 'queued',
        inputPath: s.path,
        fileName: s.info?.fileName ?? basename(s.path),
        presetLabel: preset.label,
        percent: 0,
      });
      void window.jmc.video.enqueue(spec);
    }
    setStaged([]);
  }

  const readyCount = staged.filter((s) => s.info && !s.error).length;
  const canConvert = Boolean(outputDir) && readyCount > 0;
  const [lo, hi] = preset.qualityRange ?? [14, 32];

  return (
    <div className="space-y-6">
      <DropZone hint="Videodateien hierher ziehen oder auswählen" onFiles={addFiles} onPick={pick} />

      {staged.length > 0 && (
        <div className="space-y-2">
          {staged.map((s) => (
            <div
              key={s.path}
              className="flex items-center justify-between gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{basename(s.path)}</p>
                <p className="text-[11px] text-[var(--muted-foreground)] tabular">
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
              </div>
              <button
                type="button"
                onClick={() => setStaged((prev) => prev.filter((x) => x.path !== s.path))}
                className="shrink-0 text-[11px] uppercase tracking-wide font-extrabold text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                Entfernen
              </button>
            </div>
          ))}
        </div>
      )}

      <Card className="p-5">
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

          {preset.qualityKind === 'crf' && (
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
          )}

          <div className="flex flex-col gap-2 justify-end">
            <Toggle checked={audioEnabled} onChange={setAudioEnabled} label="Audio übernehmen" />
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
        </div>

        <p className="mt-3 text-xs text-[var(--muted-foreground)]">{preset.description}</p>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)]/60 pt-4">
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
    </div>
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
