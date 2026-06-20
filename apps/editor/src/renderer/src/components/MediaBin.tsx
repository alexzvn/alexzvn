import { useEffect, useState } from 'react';
import { cn } from '@jm/ui';
import { usToSec, type MediaAsset } from '@shared/project';
import { useProject } from '@/store/project';
import { importMediaFlow } from '@/lib/actions';
import { formatShort } from '@/lib/format';

export function MediaBin() {
  const assets = useProject((s) => s.present.assets);
  const addToTimeline = useProject((s) => s.addAssetToTimeline);
  const loadSource = useProject((s) => s.loadSource);

  return (
    <div className="h-full flex flex-col bg-[var(--card)]/30 border-r border-[var(--border)]/60">
      <div className="px-3 py-2.5 border-b border-[var(--border)]/50 flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.14em] font-bold text-[var(--muted-foreground)]">
          Medien
        </span>
      </div>

      <div className="p-2 flex flex-wrap gap-1.5 border-b border-[var(--border)]/40">
        <ImportButton label="+ Video" onClick={() => void importMediaFlow('video')} />
        <ImportButton label="+ Audio" onClick={() => void importMediaFlow('audio')} />
        <ImportButton label="+ Bild" onClick={() => void importMediaFlow('image')} />
      </div>

      <div className="flex-1 overflow-auto p-2 space-y-1.5">
        {assets.length === 0 && (
          <p className="text-xs text-[var(--muted-foreground)] px-1 py-4 leading-relaxed">
            Noch keine Medien. Importiere Video-, Audio- oder Bilddateien. Doppelklick öffnet ein
            Medium in der Quelle, „+" hängt es ans Timeline-Ende.
          </p>
        )}
        {assets.map((asset) => (
          <AssetRow
            key={asset.id}
            asset={asset}
            onOpen={() => loadSource(asset.id)}
            onAdd={() => addToTimeline(asset.id)}
          />
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
        'h-7 px-2.5 rounded-[var(--radius)] text-[11px] font-bold transition-colors',
        'border border-[var(--border)] text-[var(--foreground)]/85 hover:bg-[var(--highlight)]',
      )}
    >
      {label}
    </button>
  );
}

function AssetRow({ asset, onOpen, onAdd }: { asset: MediaAsset; onOpen: () => void; onAdd: () => void }) {
  const proxy = useProject((s) => s.proxies[asset.id]);
  return (
    <div
      onDoubleClick={onOpen}
      title="Doppelklick: in der Quelle öffnen"
      className="group flex items-center gap-2 p-1.5 rounded-[var(--radius)] border border-[var(--border)]/40
                 bg-[var(--card)]/40 hover:bg-[var(--highlight)] cursor-pointer select-none"
    >
      <Thumb asset={asset} />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold truncate">{asset.fileName}</div>
        <div className="text-[10px] text-[var(--muted-foreground)] flex items-center gap-1.5">
          <span className="uppercase">{asset.kind}</span>
          <span>·</span>
          <span>{formatShort(asset.durationUs)}</span>
          {asset.width ? <span>· {asset.width}×{asset.height}</span> : null}
          {proxy?.state === 'building' && <span className="text-[var(--primary)]">· Proxy {Math.round(proxy.percent)}%</span>}
          {proxy?.state === 'ready' && asset.proxyPath && <span className="text-emerald-400">· Proxy ✓</span>}
          {proxy?.state === 'failed' && <span className="text-[var(--destructive)]">· Proxy ✗</span>}
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

function Thumb({ asset }: { asset: MediaAsset }) {
  const [url, setUrl] = useState<string>('');
  useEffect(() => {
    let alive = true;
    if (asset.kind === 'audio') return;
    void window.jmed.media
      .thumb({ path: asset.path, atSec: Math.min(1, usToSec(asset.durationUs) / 2), height: 64 })
      .then((r) => {
        if (alive) setUrl(r.dataUrl);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [asset.path, asset.kind, asset.durationUs]);

  return (
    <div className="w-14 h-9 rounded bg-black/60 overflow-hidden shrink-0 flex items-center justify-center">
      {url ? (
        <img src={url} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className="text-[var(--muted-foreground)] text-sm">{asset.kind === 'audio' ? '♪' : '▦'}</span>
      )}
    </div>
  );
}
