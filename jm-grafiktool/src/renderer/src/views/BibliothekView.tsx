import { Card } from '@/components/ui/Card';

/**
 * Placeholder for the local asset library (templates, graphics, color
 * palettes). Built out in Phase 3.
 */
export function BibliothekView() {
  return (
    <div className="h-full overflow-auto">
      <div className="max-w-[1200px] mx-auto px-7 py-6">
        <Card className="p-8">
          <h2 className="text-lg font-extrabold tracking-wide">Bibliothek</h2>
          <p className="mt-2 text-sm text-[var(--muted-foreground)] max-w-prose">
            Hier entsteht die lokale Grafik-Bibliothek: Bauchbinden-Vorlagen, Logos,
            Hintergründe und Farbpaletten — per Drag &amp; Drop in den Editor. Kommt in
            einer späteren Ausbaustufe.
          </p>
        </Card>
      </div>
    </div>
  );
}
