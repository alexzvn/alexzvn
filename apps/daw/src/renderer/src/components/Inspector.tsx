import { clipDurationUs, secToUs, usToSec, type Clip } from '@shared/project';
import { useProject, locateClip } from '@/store/project';
import { formatDb, formatTimecode } from '@/lib/format';

const inputCls =
  'w-full h-8 px-2 rounded-[var(--radius)] bg-[var(--background)] border border-[var(--border)] text-sm';

export function Inspector() {
  const selectedClipId = useProject((s) => s.selectedClipId);
  const present = useProject((s) => s.present);
  const loc = locateClip(present, selectedClipId);

  return (
    <div className="h-full flex flex-col bg-[var(--card)]/30 border-l border-[var(--border)]/60">
      <div className="px-3 py-2.5 border-b border-[var(--border)]/50">
        <span className="text-[11px] uppercase tracking-[0.14em] font-bold text-[var(--muted-foreground)]">
          Eigenschaften
        </span>
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-4">
        {!loc ? (
          <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
            Kein Clip ausgewählt. Klicke einen Clip in der Timeline an, um Pegel und Blenden zu bearbeiten.
          </p>
        ) : (
          <ClipInspector clip={loc.clip} assetName={present.assets.find((a) => a.id === loc.clip.assetId)?.fileName} />
        )}
      </div>
    </div>
  );
}

function ClipInspector({ clip, assetName }: { clip: Clip; assetName?: string }) {
  const beginDrag = useProject((s) => s.beginDrag);
  const dragUpdate = useProject((s) => s.dragUpdate);
  const endDrag = useProject((s) => s.endDrag);
  const setClipFade = useProject((s) => s.setClipFade);

  const durUs = clipDurationUs(clip);
  const durSec = usToSec(durUs);
  const fadeInSec = usToSec(clip.fade?.inUs ?? 0);
  const fadeOutSec = usToSec(clip.fade?.outUs ?? 0);

  const setGain = (v: number): void =>
    dragUpdate((d) => {
      for (const t of d.tracks) {
        const c = t.clips.find((cc) => cc.id === clip.id);
        if (c) {
          c.gain = v;
          break;
        }
      }
    });

  const updateFade = (inSec: number, outSec: number): void => {
    // Ein-/Ausblende dürfen zusammen die Cliplänge nicht überschreiten.
    const maxTotal = durSec;
    let i = Math.max(0, inSec);
    let o = Math.max(0, outSec);
    if (i + o > maxTotal) {
      if (inSec >= fadeInSec) i = Math.max(0, maxTotal - o);
      else o = Math.max(0, maxTotal - i);
    }
    setClipFade(clip.id, { inUs: secToUs(i), outUs: secToUs(o) });
  };

  return (
    <>
      <div>
        <span className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">Clip</span>
        <p className="text-sm font-semibold truncate mt-1" title={assetName}>{assetName ?? 'Clip'}</p>
        <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
          Länge {formatTimecode(durUs)} · Start {formatTimecode(clip.startUs)}
        </p>
      </div>

      <Field label={`Pegel · ${formatDb(clip.gain)} dB`}>
        <input
          type="range"
          min={0}
          max={1.6}
          step={0.01}
          value={clip.gain}
          onPointerDown={beginDrag}
          onPointerUp={endDrag}
          onChange={(e) => setGain(Number(e.target.value))}
          className="w-full"
        />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Einblende (s)">
          <input
            type="number"
            min={0}
            step={0.05}
            value={fadeInSec ? fadeInSec.toFixed(2) : ''}
            placeholder="0"
            className={inputCls}
            onChange={(e) => updateFade(Number(e.target.value) || 0, fadeOutSec)}
          />
        </Field>
        <Field label="Ausblende (s)">
          <input
            type="number"
            min={0}
            step={0.05}
            value={fadeOutSec ? fadeOutSec.toFixed(2) : ''}
            placeholder="0"
            className={inputCls}
            onChange={(e) => updateFade(fadeInSec, Number(e.target.value) || 0)}
          />
        </Field>
      </div>
    </>
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
