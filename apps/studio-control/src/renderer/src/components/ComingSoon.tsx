import { Card } from '@jm/ui';
import { Headline } from './ui/Headline';
import { SectionHeader } from './ui/SectionHeader';

export function ComingSoon({ title, note }: { title: string; note?: string }) {
  return (
    <Card className="p-10 max-w-2xl">
      <SectionHeader>Phase 2+</SectionHeader>
      <Headline variant="section" className="mt-2">
        {title}
      </Headline>
      <p className="mt-3 text-sm text-[var(--muted-foreground)] leading-relaxed">
        {note ?? 'Dieser Bereich ist im MVP noch nicht implementiert. Er wird im nächsten Schritt ergänzt.'}
      </p>
    </Card>
  );
}
