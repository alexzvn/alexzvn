import { cn } from '@jm/ui';
import type { MediaAsset } from '@shared/project';
import { useProject } from '@/store/project';
import { importAudioFlow } from '@/lib/actions';
import { formatShort } from '@/lib/format';

export function MediaBin() {
  const assets = useProject((s) => s.present.assets);
  const addToTimeline = useProject((s) => s.addAssetToTimeline);

  return (
    <div className="h-full flex flex-col bg-[var(--card)]/30 border-r border-[var(--border)]/60">
      <div className="px-3 py-2.5 border-b border-[var(--border)]/50 flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.14em] font-bold text-[var(--muted-foreground)]">
          Medien
        </span>
      </div>

      <div className="p-2 border-b border-[var(--border)]/40">
        <ImportButton label="+ Audio importieren" onClick={() => void importAudioFlow()} />
      </div>

      <div className="flex-1 overflow-auto p-2 space-y-1.5">
        {assets.length === 0 && (
          <p className="text-xs text-[var(--muted-foreground)] px-1 py-4 leading-relaxed">
            Noch keine Medien. Importiere Audiodateien (WAV, MP3, FLAC, …). „+" hängt eine Datei ans
            Ende der Ziel-Spur.
          </p>
        )}
        {assets.map((asset) => (
          <AssetRow key={asset.id} asset={asset} onAdd={() => addToTimeline(asset.id)} />
        ))}
      </div>
    </div>
  );
}

function ImportButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full h-8 px-2.5 rounded-[var(--radius)] text-[11px] font-bold transition-colors',
        'border border-[var(--border)] text-[var(--foreground)]/85 hover:bg-[var(--highlight)]',
      )}
    >
      {label}
    </button>
  );
}

function AssetRow({ asset, onAdd }: { asset: MediaAsset; onAdd: () => void }) {
  return (
    <div
      onDoubleClick={onAdd}
      title="Doppelklick: ans Ende der Ziel-Spur"
      className="group flex items-center gap-2 p-1.5 rounded-[var(--radius)] border border-[var(--border)]/40
                 bg-[var(--card)]/40 hover:bg-[var(--highlight)] cursor-pointer select-none"
    >
      <div className="w-9 h-9 rounded bg-black/60 overflow-hidden shrink-0 flex items-center justify-center text-[var(--muted-foreground)]">
        ♪
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold truncate">{asset.fileName}</div>
        <div className="text-[10px] text-[var(--muted-foreground)] flex items-center gap-1.5">
          <span>{formatShort(asset.durationUs)}</span>
          {asset.sampleRate ? <span>· {Math.round(asset.sampleRate / 1000)} kHz</span> : null}
          {asset.channels ? <span>· {asset.channels === 1 ? 'Mono' : asset.channels === 2 ? 'Stereo' : `${asset.channels}ch`}</span> : null}
          {asset.needsTranscode && <span className="text-amber-400">· wird konvertiert</span>}
        </div>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onAdd();
        }}
        className="opacity-0 group-hover:opacity-100 h-6 px-2 rounded text-[10px] font-bold
                   bg-[var(--primary)] text-[var(--primary-foreground)]"
      >
        +
      </button>
    </div>
  );
}
