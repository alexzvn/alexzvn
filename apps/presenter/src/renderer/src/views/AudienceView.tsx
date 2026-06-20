import { SlideCanvas } from '@/components/SlideCanvas';
import { usePresentation, usePresenterKeys } from '@/lib/usePresentation';

export function AudienceView() {
  const { slides, state } = usePresentation();
  usePresenterKeys(true);

  const current = slides?.[state.index] ?? null;

  // Pause screens cover the slide entirely (B/W keys, remote, presenter buttons).
  if (state.screen === 'black') {
    return <div className="h-full w-full bg-black" />;
  }
  if (state.screen === 'white') {
    return <div className="h-full w-full bg-white" />;
  }

  return (
    <div className="h-full w-full bg-black flex items-center justify-center overflow-hidden">
      {current ? (
        <SlideCanvas slide={current} maxWidth={1920} />
      ) : (
        <div className="text-white/30 text-sm">Bereit</div>
      )}
    </div>
  );
}
