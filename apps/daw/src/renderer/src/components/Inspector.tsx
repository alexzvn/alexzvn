import { useState } from 'react';
import { cn } from '@jm/ui';
import { clipDurationUs, secToUs, usToSec, type Clip, type EffectInstance, type Track } from '@shared/project';
import { useProject, locateClip, fxHolder, type FxTarget } from '@/store/project';
import { formatDb, formatTimecode } from '@/lib/format';
import { EFFECT_DEFS, type EffectKind, type ParamDef } from '@/audio/effects';

const inputCls =
  'w-full h-8 px-2 rounded-[var(--radius)] bg-[var(--background)] border border-[var(--border)] text-sm';

export function Inspector() {
  const selectedClipId = useProject((s) => s.selectedClipId);
  const present = useProject((s) => s.present);
  const activeTrackId = useProject((s) => s.activeTrackId);
  const loc = locateClip(present, selectedClipId);

  const activeTrack = present.tracks.find((t) => t.id === activeTrackId) ?? present.tracks[0];
  const buses = present.tracks.filter((t) => t.kind === 'bus');
  const [scope, setScope] = useState<'track' | 'master'>('track');
  const target: FxTarget = scope === 'master' ? { scope: 'master' } : { scope: 'track', trackId: activeTrack?.id ?? '' };
  const holder = fxHolder(present, target);
  const effects = holder?.effects ?? [];

  return (
    <div className="h-full flex flex-col bg-[var(--card)]/30 border-l border-[var(--border)]/60">
      <div className="px-3 py-2.5 border-b border-[var(--border)]/50">
        <span className="text-[11px] uppercase tracking-[0.14em] font-bold text-[var(--muted-foreground)]">
          Eigenschaften
        </span>
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-4">
        {loc && (
          <ClipInspector clip={loc.clip} assetName={present.assets.find((a) => a.id === loc.clip.assetId)?.fileName} />
        )}

        {/* ── Effekte ──────────────────────────────────────────────────── */}
        <div className="pt-1">
          <div className="flex items-center gap-1 mb-2">
            <span className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] mr-auto">Effekte</span>
            <ScopeTab label={activeTrack ? activeTrack.name : 'Spur'} active={scope === 'track'} onClick={() => setScope('track')} />
            <ScopeTab label="Master" active={scope === 'master'} onClick={() => setScope('master')} />
          </div>

          {effects.length === 0 && (
            <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed mb-2">
              Keine Effekte auf {scope === 'master' ? 'dem Master' : `„${activeTrack?.name}"`}. Füge EQ, Kompressor
              oder Reverb hinzu.
            </p>
          )}

          <div className="space-y-2">
            {effects.map((eff) => (
              <EffectCard key={eff.id} effect={eff} target={target} />
            ))}
          </div>

          <AddEffect target={target} />
        </div>

        {/* ── Sends (nur Audio-Spuren) ─────────────────────────────────── */}
        {activeTrack && activeTrack.kind === 'audio' && buses.length > 0 && (
          <SendsSection track={activeTrack} buses={buses} />
        )}
      </div>
    </div>
  );
}

function SendsSection({ track, buses }: { track: Track; buses: Track[] }) {
  const addSend = useProject((s) => s.addSend);
  const removeSend = useProject((s) => s.removeSend);
  const beginDrag = useProject((s) => s.beginDrag);
  const dragUpdate = useProject((s) => s.dragUpdate);
  const endDrag = useProject((s) => s.endDrag);

  const sends = track.sends ?? [];
  const setSendGain = (busId: string, db: number): void =>
    dragUpdate((d) => {
      const s = d.tracks.find((t) => t.id === track.id)?.sends?.find((ss) => ss.busId === busId);
      if (s) s.gainDb = db;
    });

  return (
    <div className="pt-3 border-t border-[var(--border)]/40">
      <span className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">Sends</span>
      <div className="mt-2 space-y-1.5">
        {buses.map((bus) => {
          const send = sends.find((s) => s.busId === bus.id);
          return (
            <div key={bus.id} className="flex items-center gap-2">
              <button
                type="button"
                title={send ? 'Send aus' : 'Send an'}
                onClick={() => (send ? removeSend(track.id, bus.id) : addSend(track.id, bus.id))}
                className={cn(
                  'w-5 h-5 shrink-0 rounded text-[10px] font-bold',
                  send ? 'bg-violet-500 text-white' : 'border border-[var(--border)] text-[var(--muted-foreground)]',
                )}
              >
                {send ? '●' : '○'}
              </button>
              <span className="text-[11px] truncate w-[64px]" title={bus.name}>{bus.name}</span>
              {send ? (
                <>
                  <input
                    type="range"
                    min={-60}
                    max={6}
                    step={1}
                    value={send.gainDb}
                    onPointerDown={beginDrag}
                    onPointerUp={endDrag}
                    onChange={(e) => setSendGain(bus.id, Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-[10px] tabular-nums w-[44px] text-right">
                    {send.gainDb <= -60 ? '−∞' : `${send.gainDb > 0 ? '+' : ''}${send.gainDb}`} dB
                  </span>
                </>
              ) : (
                <span className="flex-1 text-[10px] text-[var(--muted-foreground)]">aus</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScopeTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={cn(
        'h-6 max-w-[96px] truncate px-2 rounded text-[10px] font-bold border',
        active
          ? 'bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]'
          : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--highlight)]',
      )}
    >
      {label}
    </button>
  );
}

function AddEffect({ target }: { target: FxTarget }) {
  const addEffect = useProject((s) => s.addEffect);
  return (
    <select
      className={cn(inputCls, 'mt-2 text-xs')}
      value=""
      onChange={(e) => {
        if (e.target.value) addEffect(target, e.target.value as EffectKind);
        e.currentTarget.selectedIndex = 0;
      }}
    >
      <option value="">+ Effekt hinzufügen …</option>
      {(Object.keys(EFFECT_DEFS) as EffectKind[]).map((k) => (
        <option key={k} value={k}>
          {EFFECT_DEFS[k].label}
        </option>
      ))}
    </select>
  );
}

function EffectCard({ effect, target }: { effect: EffectInstance; target: FxTarget }) {
  const def = EFFECT_DEFS[effect.kind as EffectKind];
  const removeEffect = useProject((s) => s.removeEffect);
  const beginDrag = useProject((s) => s.beginDrag);
  const dragUpdate = useProject((s) => s.dragUpdate);
  const endDrag = useProject((s) => s.endDrag);
  if (!def) return null;

  const setParam = (key: string, value: number): void =>
    dragUpdate((d) => {
      const eff = fxHolder(d, target)?.effects?.find((e) => e.id === effect.id);
      if (eff) eff.params[key] = value;
    });

  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)]/60 bg-[var(--background)]/40 p-2">
      <div className="flex items-center gap-1 mb-1.5">
        <span className="text-[11px] font-bold">{def.label}</span>
        <button
          type="button"
          title="Effekt entfernen"
          onClick={() => removeEffect(target, effect.id)}
          className="ml-auto w-4 h-4 rounded text-[10px] text-[var(--muted-foreground)] hover:text-[var(--destructive)]"
        >
          ✕
        </button>
      </div>
      <div className="space-y-1.5">
        {def.params.map((p) => (
          <ParamSlider
            key={p.key}
            def={p}
            value={typeof effect.params[p.key] === 'number' ? (effect.params[p.key] as number) : p.default}
            onBegin={beginDrag}
            onEnd={endDrag}
            onChange={(v) => setParam(p.key, v)}
          />
        ))}
      </div>
    </div>
  );
}

function ParamSlider({
  def,
  value,
  onBegin,
  onEnd,
  onChange,
}: {
  def: ParamDef;
  value: number;
  onBegin: () => void;
  onEnd: () => void;
  onChange: (v: number) => void;
}) {
  const decimals = def.step < 1 ? 2 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-[var(--muted-foreground)]">{def.label}</span>
        <span className="tabular-nums">
          {value.toFixed(decimals)}
          {def.unit ? ` ${def.unit}` : ''}
        </span>
      </div>
      <input
        type="range"
        min={def.min}
        max={def.max}
        step={def.step}
        value={value}
        onPointerDown={onBegin}
        onPointerUp={onEnd}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
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
    <div className="space-y-4 pb-2 border-b border-[var(--border)]/40">
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
