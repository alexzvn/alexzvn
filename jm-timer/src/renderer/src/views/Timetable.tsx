import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { StatusPill } from '@/components/ui/StatusPill';

export function TimetablePlaceholder() {
  return (
    <section className="flex flex-col h-full px-2 max-w-[960px]">
      <div className="flex items-center justify-between pb-6">
        <SectionHeader>Timetable</SectionHeader>
        <StatusPill status="setup">Phase 3</StatusPill>
      </div>

      <Card>
        <div className="p-12 flex flex-col items-center text-center gap-3">
          <div className="text-xl font-semibold">Coming up</div>
          <p className="text-sm text-[var(--muted-foreground)] max-w-md">
            XLSX-Import und manuelle Pflege des Regieplans. Liefere ich nach dem Multi-Window-Sync
            (Phase 3).
          </p>
        </div>
      </Card>
    </section>
  );
}
