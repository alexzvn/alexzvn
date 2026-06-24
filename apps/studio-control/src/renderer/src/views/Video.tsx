import { TricasterPanel } from '@/components/video/TricasterPanel';
import { AtemPanel } from '@/components/video/AtemPanel';
import { ObsPanel } from '@/components/video/ObsPanel';
import { PtzPanel } from '@/components/video/PtzPanel';

export function VideoView() {
  return (
    <div className="flex flex-col gap-6">
      <TricasterPanel />
      <AtemPanel />
      <ObsPanel />
      <PtzPanel />
    </div>
  );
}
