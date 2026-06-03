import { useState } from 'react';
import { useActiveLayer, useEditor } from '@/store/editor';
import { BLEND_LABELS, BLEND_MODES } from '@/engine/doc/BlendMode';
import type { BlendMode } from '@/engine/types';
import { Select } from '@/components/ui/Select';
import { Slider, PanelLabel } from './controls';
import { Icon } from './Icons';
import { cn } from '@/lib/cn';

export function LayersPanel() {
  const controller = useEditor((s) => s.controller);
  const layers = useEditor((s) => s.layers);
  const active = useActiveLayer();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [opacityDrag, setOpacityDrag] = useState<number | null>(null);
  if (!controller) return null;

  const activeIndex = layers.findIndex((l) => l.isActive);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-3 py-2 flex items-center justify-between border-b border-[var(--border)]/50">
        <PanelLabel>Ebenen</PanelLabel>
        <div className="flex items-center gap-1 text-[var(--foreground)]/70">
          <IconBtn title="Nach oben" disabled={activeIndex <= 0} onClick={() => active && controller.reorderLayer(active.id, activeIndex - 1)}>
            <Icon.up />
          </IconBtn>
          <IconBtn title="Nach unten" disabled={activeIndex < 0 || activeIndex >= layers.length - 1} onClick={() => active && controller.reorderLayer(active.id, activeIndex + 1)}>
            <Icon.down />
          </IconBtn>
          <IconBtn title="Duplizieren" disabled={!active} onClick={() => active && controller.duplicateLayer(active.id)}>
            <Icon.duplicate />
          </IconBtn>
          <IconBtn title="Neue Ebene" onClick={() => controller.addRasterLayer()}>
            <Icon.plus />
          </IconBtn>
          <IconBtn title="Löschen" disabled={!active || layers.length <= 1} onClick={() => active && controller.deleteLayer(active.id)}>
            <Icon.trash />
          </IconBtn>
        </div>
      </div>

      {active && (
        <div className="px-3 py-2.5 flex flex-col gap-2 border-b border-[var(--border)]/50">
          <Select
            options={BLEND_MODES.map((m) => ({ value: m, label: BLEND_LABELS[m] }))}
            value={active.blendMode}
            onChange={(e) => controller.setLayerBlend(active.id, e.target.value as BlendMode)}
          />
          <Slider
            label="Deckkraft"
            unit="%"
            min={0}
            max={100}
            value={(opacityDrag ?? active.opacity) * 100}
            onCommitStart={() => setOpacityDrag(active.opacity)}
            onCommitEnd={() => {
              if (opacityDrag !== null) controller.commitLayerOpacity(active.id, opacityDrag, active.opacity);
              setOpacityDrag(null);
            }}
            onChange={(v) => controller.setLayerOpacity(active.id, v / 100)}
          />
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto py-1">
        {layers.map((l) => (
          <div
            key={l.id}
            onClick={() => controller.selectLayer(l.id)}
            className={cn(
              'group mx-1.5 my-0.5 px-2 py-1.5 rounded-[var(--radius)] flex items-center gap-2 cursor-pointer',
              l.isActive ? 'bg-[var(--highlight)] ring-1 ring-[var(--primary)]/40' : 'hover:bg-[var(--highlight)]/60',
            )}
          >
            <button
              type="button"
              title={l.visible ? 'Ausblenden' : 'Einblenden'}
              onClick={(e) => {
                e.stopPropagation();
                controller.setLayerVisible(l.id, !l.visible);
              }}
              className={cn('shrink-0', l.visible ? 'text-[var(--foreground)]/80' : 'text-[var(--muted-foreground)]/50')}
            >
              {l.visible ? <Icon.eye /> : <Icon.eyeOff />}
            </button>
            <div className="w-9 h-9 shrink-0 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[#222] overflow-hidden grid place-items-center jmg-checker">
              <img src={l.thumbnail} alt="" className="max-w-full max-h-full object-contain" />
            </div>
            {renaming === l.id ? (
              <input
                autoFocus
                defaultValue={l.name}
                onBlur={(e) => {
                  controller.renameLayer(l.id, e.target.value || l.name);
                  setRenaming(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  if (e.key === 'Escape') setRenaming(null);
                }}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 min-w-0 h-7 px-1.5 rounded-[var(--radius-sm)] bg-[var(--input)] border border-[var(--border)] text-[12px]"
              />
            ) : (
              <span
                className="flex-1 min-w-0 truncate text-[12px] font-medium"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setRenaming(l.id);
                }}
              >
                {l.name}
              </span>
            )}
            <button
              type="button"
              title={l.locked ? 'Entsperren' : 'Sperren'}
              onClick={(e) => {
                e.stopPropagation();
                controller.setLayerLocked(l.id, !l.locked);
              }}
              className={cn(
                'shrink-0 transition-opacity',
                l.locked ? 'text-[var(--primary)]' : 'text-[var(--muted-foreground)]/60 opacity-0 group-hover:opacity-100',
              )}
            >
              {l.locked ? <Icon.lock /> : <Icon.unlock />}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="w-7 h-7 grid place-items-center rounded-[var(--radius-sm)] hover:bg-[var(--highlight)] disabled:opacity-30 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}
