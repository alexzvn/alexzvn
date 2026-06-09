import { useTick } from '@/lib/useTick';
import { TimerDisplay } from './TimerDisplay';
import { SectionHeader } from './ui/SectionHeader';
import { StatusPill } from './ui/StatusPill';

export function Clock() {
  const now = useTick();
  const d = new Date(now);
  const msOfDay =
    ((d.getHours() * 60 + d.getMinutes()) * 60 + d.getSeconds()) * 1000;

  const dateLabel = d.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <section className="flex flex-col h-full px-2">
      <div className="flex items-center justify-between pb-6">
        <SectionHeader>Real-Time Clock</SectionHeader>
        <StatusPill status="live">Live</StatusPill>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        <TimerDisplay ms={msOfDay} reactive={false} />
        <div className="text-sm uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
          {dateLabel}
        </div>
      </div>
    </section>
  );
}
