import type { RefObject } from 'react';
import { Card } from '@jm/ui';

interface Props {
  canvasRef: RefObject<HTMLCanvasElement>;
  active: boolean;
}

export function Preview({ canvasRef, active }: Props) {
  return (
    <Card variant="nested" glossy={false} className="overflow-hidden p-0">
      <div className="relative aspect-video w-full bg-black">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full object-contain" />
        {!active ? (
          <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-[var(--muted-foreground)]">
            Keine Vorschau – Quelle wählen und starten
          </div>
        ) : null}
      </div>
    </Card>
  );
}
