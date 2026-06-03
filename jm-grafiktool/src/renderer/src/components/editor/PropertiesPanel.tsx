import { useActiveLayer, useEditor } from '@/store/editor';
import { hexToRgba, rgbToHex } from '@/engine/color';
import type { TextStyle } from '@/engine/types';
import { PanelLabel, Slider, Swatch, Segment, Toggle } from './controls';

export function PropertiesPanel() {
  const controller = useEditor((s) => s.controller);
  const active = useActiveLayer();
  // Read the live layer for its style; re-renders on every store sync.
  const layer = controller && active ? controller.doc.layerById(active.id) : null;
  if (!controller) return null;

  if (layer?.kind === 'text') {
    const st = layer.style;
    const set = (patch: Partial<TextStyle>) => controller.updateTextStyle(layer.id, patch);
    return (
      <div className="p-3 flex flex-col gap-2.5">
        <PanelLabel>Text</PanelLabel>
        <textarea
          value={st.text}
          onChange={(e) => set({ text: e.target.value })}
          rows={2}
          className="w-full px-2 py-1.5 rounded-[var(--radius)] bg-[var(--input)] border border-[var(--border)] text-[12px] resize-none"
        />
        <Slider label="Schriftgröße" unit="px" min={8} max={400} value={st.fontSize} onChange={(v) => set({ fontSize: v })} />
        <div className="flex items-center justify-between">
          <PanelLabel>Stärke</PanelLabel>
          <Segment
            value={String(st.fontWeight)}
            onChange={(v) => set({ fontWeight: Number(v) })}
            options={[
              { value: '400', label: 'R' },
              { value: '600', label: 'M' },
              { value: '800', label: 'B' },
            ]}
          />
        </div>
        <div className="flex items-center justify-between">
          <PanelLabel>Ausrichtung</PanelLabel>
          <Segment
            value={st.align}
            onChange={(v) => set({ align: v as TextStyle['align'] })}
            options={[
              { value: 'left', label: 'L' },
              { value: 'center', label: 'M' },
              { value: 'right', label: 'R' },
            ]}
          />
        </div>
        <div className="flex items-center justify-between">
          <PanelLabel>Textfarbe</PanelLabel>
          <Swatch color={rgbToHex(st.color)} onChange={(hex) => set({ color: hexToRgba(hex) })} />
        </div>
        <div className="flex items-center justify-between">
          <PanelLabel>Hintergrund-Plate</PanelLabel>
          <div className="flex items-center gap-2">
            <Toggle
              label={st.background ? 'An' : 'Aus'}
              checked={!!st.background}
              onChange={(on) => set({ background: on ? hexToRgba('#1a1a1a') : null })}
            />
            {st.background && (
              <Swatch color={rgbToHex(st.background)} onChange={(hex) => set({ background: hexToRgba(hex) })} />
            )}
          </div>
        </div>
        {st.background && (
          <Slider label="Innenabstand" unit="px" min={0} max={80} value={st.padding} onChange={(v) => set({ padding: v })} />
        )}
      </div>
    );
  }

  if (layer?.kind === 'shape') {
    const st = layer.style;
    const set = controller.updateShapeStyle.bind(controller);
    return (
      <div className="p-3 flex flex-col gap-2.5">
        <PanelLabel>Form</PanelLabel>
        <div className="flex items-center justify-between">
          <PanelLabel>Füllung</PanelLabel>
          <div className="flex items-center gap-2">
            <Toggle label={st.fill ? 'An' : 'Aus'} checked={!!st.fill} onChange={(on) => set(layer.id, { fill: on ? hexToRgba('#fbe73b') : null })} />
            {st.fill && <Swatch color={rgbToHex(st.fill)} onChange={(hex) => set(layer.id, { fill: hexToRgba(hex) })} />}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <PanelLabel>Kontur</PanelLabel>
          <div className="flex items-center gap-2">
            <Toggle label={st.stroke ? 'An' : 'Aus'} checked={!!st.stroke} onChange={(on) => set(layer.id, { stroke: on ? hexToRgba('#000000') : null })} />
            {st.stroke && <Swatch color={rgbToHex(st.stroke)} onChange={(hex) => set(layer.id, { stroke: hexToRgba(hex) })} />}
          </div>
        </div>
        {st.stroke && (
          <Slider label="Konturstärke" unit="px" min={1} max={80} value={st.strokeWidth} onChange={(v) => set(layer.id, { strokeWidth: v })} />
        )}
      </div>
    );
  }

  return (
    <div className="p-4 text-xs text-[var(--muted-foreground)] leading-relaxed">
      Keine bearbeitbaren Eigenschaften für diese Ebene.
      <br />
      Wähle eine <strong className="text-[var(--foreground)]/80">Text-</strong> oder{' '}
      <strong className="text-[var(--foreground)]/80">Form-Ebene</strong>, oder erstelle eine mit den
      Werkzeugen <strong className="text-[var(--foreground)]/80">T</strong> /{' '}
      <strong className="text-[var(--foreground)]/80">U</strong>.
    </div>
  );
}
