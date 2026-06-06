import { SlideCanvas } from '@/components/SlideCanvas';
import { usePresentation, usePresenterKeys } from '@/lib/usePresentation';

export function AudienceView() {
  const { slides, state } = usePresentation();
  usePresenterKeys(true);

  const current = slides?.[state.index] ?? null;

  return (
    <div className="h-full w-full bg-black grid place-items-center overflow-hidden">
      {current ? (
        <SlideCanvas slide={current} maxWidth={1920} />
      ) : (
        <div className="text-white/30 text-sm">Bereit</div>
      )}
    </div>
  );
}
