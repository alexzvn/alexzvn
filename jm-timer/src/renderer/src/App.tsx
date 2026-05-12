import { useStore } from '@/store/timer';
import { AppShell } from '@/components/AppShell';
import { Clock } from '@/components/Clock';
import { Countdown } from '@/components/Countdown';
import { ColorPicker } from '@/components/ColorPicker';
import { TimetablePlaceholder } from '@/views/Timetable';

export function App() {
  const mode = useStore((s) => s.mode);

  return (
    <AppShell>
      {mode === 'clock' && <Clock />}
      {mode === 'countdown' && <Countdown />}
      {mode === 'timetable' && <TimetablePlaceholder />}
      {mode === 'settings' && <ColorPicker />}
    </AppShell>
  );
}
