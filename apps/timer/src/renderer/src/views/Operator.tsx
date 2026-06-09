import { useStore } from '@/store/timer';
import { AppShell } from '@/components/AppShell';
import { Clock } from '@/components/Clock';
import { Countdown } from '@/components/Countdown';
import { ColorPicker } from '@/components/ColorPicker';
import { Timetable } from '@/components/Timetable';
import { RemoteInfo } from '@/components/RemoteInfo';
import { useAutoAdvance } from '@/sync/useAutoAdvance';

export function OperatorView() {
  const mode = useStore((s) => s.mode);
  // Auto-advance runs only here — Speaker/Remote windows never dispatch
  // commands, so we avoid duplicate `tt:next` fires.
  useAutoAdvance();

  return (
    <AppShell>
      {mode === 'clock' && <Clock />}
      {mode === 'countdown' && <Countdown />}
      {mode === 'timetable' && <Timetable />}
      {mode === 'remote' && <RemoteInfo />}
      {mode === 'settings' && <ColorPicker />}
    </AppShell>
  );
}
