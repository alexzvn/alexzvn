import { TricasterPanel } from '@/components/video/TricasterPanel';
import { PtzPanel } from '@/components/video/PtzPanel';
import { Card } from '@jm/ui';
import { Headline } from '@/components/ui/Headline';
import { SectionHeader } from '@/components/ui/SectionHeader';

export function VideoView() {
  return (
    <div className="flex flex-col gap-6">
      <TricasterPanel />
      <PtzPanel />
      <Card variant="nested" className="p-6 opacity-60">
        <SectionHeader>Phase 3</SectionHeader>
        <Headline variant="subsection" className="mt-2">
          Kumo Matrix · Ultimatte
        </Headline>
        <p className="mt-2 text-xs text-[var(--muted-foreground)]">
          Diese Module folgen als Nächstes. Geräte können bereits im Setup-Tab gepflegt werden.
        </p>
      </Card>
    </div>
  );
}
