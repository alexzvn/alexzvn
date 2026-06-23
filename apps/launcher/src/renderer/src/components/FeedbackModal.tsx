import { useState } from 'react';
import { Button, Card, cn } from '@jm/ui';
import type { FeedbackInput } from '@shared/types';
import { useTools } from '@/store/tools';

export function FeedbackModal() {
  const open = useTools((s) => s.feedbackOpen);
  const close = useTools((s) => s.closeFeedback);
  const submit = useTools((s) => s.submitFeedback);

  const [type, setType] = useState<FeedbackInput['type']>('bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [includeLogs, setIncludeLogs] = useState(true);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const canSend = title.trim().length > 0 && description.trim().length > 0 && !busy;

  const onSend = async (): Promise<void> => {
    setBusy(true);
    try {
      const res = await submit({ type, title, description, includeLogs });
      if (res.ok) {
        setTitle('');
        setDescription('');
        setType('bug');
        setIncludeLogs(true);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm px-6">
      <Card className="w-full max-w-lg p-6 jm-fade-in">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight">Feedback senden</h2>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            Bug melden oder eine Funktion / ein neues Tool wünschen — landet direkt im Projekt.
          </p>
        </div>

        <div className="mt-5 flex gap-2">
          <TypeButton active={type === 'bug'} onClick={() => setType('bug')} label="Bug" />
          <TypeButton active={type === 'feature'} onClick={() => setType('feature')} label="Wunsch" />
        </div>

        <div className="mt-5 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-[0.12em] font-extrabold text-[var(--muted-foreground)]">
              Titel
            </span>
            <input
              value={title}
              placeholder={type === 'bug' ? 'Kurz: was klemmt?' : 'Kurz: was wünschst du dir?'}
              onChange={(e) => setTitle(e.target.value)}
              className={cn(
                'h-10 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)]',
                'px-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]',
                'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]',
              )}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-[0.12em] font-extrabold text-[var(--muted-foreground)]">
              Beschreibung
            </span>
            <textarea
              value={description}
              rows={5}
              placeholder={
                type === 'bug'
                  ? 'Was ist passiert, welche Schritte, welches Tool?'
                  : 'Beschreibe die gewünschte Funktion oder das neue Tool.'
              }
              onChange={(e) => setDescription(e.target.value)}
              className={cn(
                'rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] resize-none',
                'px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]',
                'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]',
              )}
            />
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeLogs}
              onChange={(e) => setIncludeLogs(e.target.checked)}
              className="size-4 accent-[var(--primary)]"
            />
            <span className="text-xs text-[var(--muted-foreground)]">
              Aktuelle Logs anhängen (Launcher + zuletzt genutzte Tools) — hilft bei Fehlerberichten
            </span>
          </label>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="ghost" onClick={close} disabled={busy}>
            Abbrechen
          </Button>
          <Button variant="primary" disabled={!canSend} onClick={() => void onSend()}>
            {busy ? 'Sende…' : 'Senden'}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function TypeButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-9 px-4 rounded-[var(--radius)] text-xs uppercase tracking-wide font-extrabold border transition-colors',
        active
          ? 'border-[var(--primary)]/50 bg-[var(--primary)]/15 text-[var(--foreground)]'
          : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--highlight)]',
      )}
    >
      {label}
    </button>
  );
}
