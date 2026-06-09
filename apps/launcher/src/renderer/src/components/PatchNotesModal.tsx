import { useState } from 'react';
import { Button, Card, cn } from '@jm/ui';
import { CHANGELOG, changelogFor } from '@/data/changelog';
import { useTools } from '@/store/tools';

export function PatchNotesModal() {
  const patchNotes = useTools((s) => s.patchNotes);
  const close = useTools((s) => s.closePatchNotes);
  // Welche App-Notes sind initial gewählt? Die aus dem Auslöser, sonst Launcher.
  const [selected, setSelected] = useState(patchNotes?.app ?? 'launcher');

  if (!patchNotes) return null;

  const isWhatsNew = Boolean(patchNotes.highlight) && patchNotes.app === selected;
  const app = changelogFor(selected) ?? changelogFor('launcher');

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm px-6">
      <Card className="w-full max-w-3xl p-0 jm-fade-in overflow-hidden">
        <div className="flex items-start justify-between gap-4 px-6 pt-6">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight">
              {isWhatsNew ? 'Was ist neu?' : 'Patch Notes'}
            </h2>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">
              {isWhatsNew
                ? `${app?.name} wurde aktualisiert — die Änderungen im Überblick.`
                : 'Änderungen der Apps der JM Production Suite.'}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Schließen"
            className="grid place-items-center size-8 shrink-0 rounded-[var(--radius)] border border-[var(--border)]
                       text-[var(--muted-foreground)] hover:bg-[var(--highlight)] hover:text-[var(--foreground)] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-5 grid grid-cols-[180px_1fr] gap-0 border-t border-[var(--border)]">
          {/* App-Auswahl */}
          <nav className="border-r border-[var(--border)] p-2 max-h-[55vh] overflow-auto">
            {CHANGELOG.map((c) => {
              const active = c.app === selected;
              return (
                <button
                  key={c.app}
                  type="button"
                  onClick={() => setSelected(c.app)}
                  className={cn(
                    'w-full text-left rounded-[var(--radius)] px-3 py-2 text-sm font-semibold transition-colors',
                    active
                      ? 'bg-[var(--highlight)] text-[var(--foreground)]'
                      : 'text-[var(--muted-foreground)] hover:bg-[var(--highlight)]/60 hover:text-[var(--foreground)]',
                  )}
                >
                  {c.name}
                </button>
              );
            })}
          </nav>

          {/* Einträge der gewählten App */}
          <div className="p-5 max-h-[55vh] overflow-auto flex flex-col gap-5">
            {app?.entries.map((entry) => {
              const highlight = isWhatsNew && entry.version === patchNotes.highlight;
              return (
                <div key={entry.version}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold tabular-nums">v{entry.version}</span>
                    {highlight && (
                      <span className="rounded-[var(--radius-full)] border border-[var(--primary)]/50 bg-[var(--highlight)]
                                       px-2 py-px text-[10px] font-extrabold uppercase tracking-[0.1em] text-[var(--primary)]">
                        Neu
                      </span>
                    )}
                    {entry.date && (
                      <span className="text-[11px] text-[var(--muted-foreground)] tabular-nums">{entry.date}</span>
                    )}
                  </div>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {entry.notes.map((note, i) => (
                      <li key={i} className="flex gap-2 text-sm leading-snug text-[var(--foreground)]/85">
                        <span className="mt-2 size-1 shrink-0 rounded-full bg-[var(--primary)]" aria-hidden />
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            {!app?.entries.length && (
              <p className="text-sm text-[var(--muted-foreground)]">Keine Notizen vorhanden.</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-6 py-4">
          <span className="text-[11px] text-[var(--muted-foreground)]">
            Wird pro Version nur einmal automatisch angezeigt.
          </span>
          <Button variant="primary" onClick={close}>
            {isWhatsNew ? 'Verstanden' : 'Schließen'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
