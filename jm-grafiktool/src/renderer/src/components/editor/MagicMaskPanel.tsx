import { useState } from 'react';
import { useEditor } from '@/store/editor';
import { Button } from '@/components/ui/Button';
import { PanelLabel } from './controls';
import { useAiStatus } from './useAiStatus';
import { freistellen } from './magicMask';

/** Magic Mask / Freistellen controls for the active raster layer. */
export function MagicMaskPanel({ layerId }: { layerId: string }) {
  const controller = useEditor((s) => s.controller);
  const summary = useEditor((s) => s.layers.find((l) => l.id === layerId));
  const status = useAiStatus();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!controller) return null;

  const aiAvailable = !!window.jmg?.ai;
  const modelMissing = aiAvailable && status !== null && !status.modelPresent;
  const hasMask = !!summary?.hasMask;

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await freistellen(controller, layerId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-3 flex flex-col gap-2.5">
      <PanelLabel>Freistellen · Magic Mask</PanelLabel>
      <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed">
        Entfernt automatisch den Hintergrund per lokalem KI-Modell (offline). Das Ergebnis wird als
        Ebenenmaske angelegt — zerstörungsfrei und jederzeit widerrufbar.
      </p>

      {!aiAvailable && (
        <p className="text-[11px] text-[var(--muted-foreground)]">Nur in der Desktop-App verfügbar.</p>
      )}
      {modelMissing && (
        <p className="text-[11px] text-[var(--destructive)]">KI-Modell nicht gefunden (u2netp.onnx).</p>
      )}

      <Button
        size="sm"
        variant="primary"
        uppercase={false}
        onClick={run}
        disabled={busy || !aiAvailable || modelMissing}
        className="w-full"
      >
        {busy ? 'Wird freigestellt…' : 'Hintergrund entfernen'}
      </Button>

      {hasMask && (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" uppercase={false} onClick={() => controller.setLayerMask(layerId, null)} disabled={busy} className="flex-1">
            Maske entfernen
          </Button>
          <Button size="sm" variant="ghost" uppercase={false} onClick={() => controller.applyMask(layerId)} disabled={busy}>
            Anwenden
          </Button>
        </div>
      )}

      {error && <p className="text-[11px] text-[var(--destructive)]">{error}</p>}
    </div>
  );
}
