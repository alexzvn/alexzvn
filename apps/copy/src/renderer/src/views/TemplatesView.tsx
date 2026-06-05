import { useEffect, useState } from 'react';
import { Card } from '@jm/ui';
import { Button } from '@jm/ui';
import { useTemplates, allTemplates, type SavedTemplate } from '@/store/templates';
import {
  DATE_TOKENS,
  PROJECT_TOKENS,
  ALL_TOKENS,
  resolvePattern,
  type TemplateFields,
} from '@shared/template';
import { cn } from '@jm/ui';

interface Draft {
  id: string;
  name: string;
  pattern: string;
  subfolders: string[];
  builtin: boolean;
}

const EXAMPLE_FIELDS: TemplateFields = Object.fromEntries(
  PROJECT_TOKENS.map((t) => [t.key, t.example]),
);

function toDraft(t: SavedTemplate): Draft {
  return {
    id: t.id,
    name: t.name,
    pattern: t.pattern,
    subfolders: [...t.subfolders],
    builtin: !!t.builtin,
  };
}

export function TemplatesView() {
  const state = useTemplates();
  const templates = allTemplates(state);
  const [draft, setDraft] = useState<Draft>(() => toDraft(templates[0]));
  const [subInput, setSubInput] = useState('');

  // Keep the editor in sync when the selected template changes elsewhere.
  useEffect(() => {
    const sel = templates.find((t) => t.id === state.selectedId);
    if (sel && sel.id !== draft.id) setDraft(toDraft(sel));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.selectedId]);

  const preview = resolvePattern(draft.pattern, EXAMPLE_FIELDS, new Date());

  const insertToken = (key: string) =>
    setDraft((d) => ({ ...d, pattern: `${d.pattern}{${key}}` }));

  const addSub = () => {
    const v = subInput.trim();
    if (!v || draft.subfolders.includes(v)) return;
    setDraft((d) => ({ ...d, subfolders: [...d.subfolders, v] }));
    setSubInput('');
  };

  const saveAsNew = () => {
    const id = crypto.randomUUID();
    const name = draft.builtin ? `${draft.name} (Kopie)` : draft.name || 'Neue Vorlage';
    const tpl: SavedTemplate = { id, name, pattern: draft.pattern, subfolders: draft.subfolders };
    state.upsert(tpl);
    setDraft({ ...toDraft(tpl) });
  };

  const save = () => {
    if (draft.builtin) {
      saveAsNew();
      return;
    }
    state.upsert({
      id: draft.id,
      name: draft.name || 'Vorlage',
      pattern: draft.pattern,
      subfolders: draft.subfolders,
    });
  };

  const newTemplate = () => {
    const tpl: Draft = {
      id: crypto.randomUUID(),
      name: 'Neue Vorlage',
      pattern: '{date}_{projekt}',
      subfolders: [],
      builtin: false,
    };
    setDraft(tpl);
  };

  return (
    <div className="grid grid-cols-[260px_1fr] gap-5 h-full pb-10">
      {/* Template list */}
      <Card>
        <div className="p-3">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[11px] uppercase tracking-[0.12em] font-bold text-[var(--muted-foreground)]">
              Vorlagen
            </span>
            <button
              type="button"
              onClick={newTemplate}
              className="text-xs font-bold text-[var(--primary)] hover:underline"
            >
              + Neu
            </button>
          </div>
          <div className="space-y-1">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  state.setSelected(t.id);
                  setDraft(toDraft(t));
                }}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-[var(--radius)] text-sm font-semibold transition-colors',
                  draft.id === t.id
                    ? 'bg-[var(--highlight)] text-[var(--foreground)]'
                    : 'hover:bg-[var(--muted)]/60 text-[var(--foreground)]/80',
                )}
              >
                <span className="truncate block">
                  {t.builtin ? '★ ' : ''}
                  {t.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Editor */}
      <Card>
        <div className="p-5 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <input
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              disabled={draft.builtin}
              className={cn(
                'flex-1 h-10 px-3 rounded-[var(--radius)] text-base font-bold',
                'bg-[var(--input)] border border-[var(--border)]',
                'disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-[var(--ring)]',
              )}
            />
            {draft.builtin && (
              <span className="text-xs text-[var(--muted-foreground)]">
                Standardvorlage — beim Speichern als Kopie
              </span>
            )}
          </div>

          {/* Pattern */}
          <div>
            <Label>Ordner-Muster</Label>
            <input
              value={draft.pattern}
              onChange={(e) => setDraft((d) => ({ ...d, pattern: e.target.value }))}
              placeholder="{kunde}/{date}_{projekt}"
              className={cn(
                'h-10 w-full px-3 rounded-[var(--radius)] font-mono text-sm',
                'bg-[var(--input)] border border-[var(--border)]',
                'focus-visible:outline-2 focus-visible:outline-[var(--ring)]',
              )}
            />
            <div className="mt-3 space-y-2">
              <TokenRow label="Datum/Zeit" tokens={DATE_TOKENS} onInsert={insertToken} />
              <TokenRow label="Projekt" tokens={PROJECT_TOKENS} onInsert={insertToken} />
            </div>
          </div>

          {/* Subfolders */}
          <div>
            <Label>Feste Unterordner</Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {draft.subfolders.length === 0 && (
                <span className="text-xs text-[var(--muted-foreground)]">keine</span>
              )}
              {draft.subfolders.map((s) => (
                <span
                  key={s}
                  className="group inline-flex items-center gap-1.5 text-xs font-semibold
                             px-2 py-1 rounded-full bg-[var(--highlight)]"
                >
                  {s}
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((d) => ({ ...d, subfolders: d.subfolders.filter((x) => x !== s) }))
                    }
                    className="text-[var(--muted-foreground)] hover:text-[var(--destructive)]"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={subInput}
                onChange={(e) => setSubInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addSub()}
                placeholder="z. B. Footage"
                className={cn(
                  'h-9 flex-1 px-3 rounded-[var(--radius)] text-sm',
                  'bg-[var(--input)] border border-[var(--border)]',
                  'focus-visible:outline-2 focus-visible:outline-[var(--ring)]',
                )}
              />
              <Button variant="outline" size="sm" uppercase={false} onClick={addSub}>
                Hinzufügen
              </Button>
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--muted)]/40 p-3">
            <Label>Beispiel-Pfad</Label>
            <code className="block text-sm break-all text-[var(--foreground)]">
              {preview || '(leer)'}
              {draft.subfolders.length > 0 && (
                <span className="text-[var(--muted-foreground)]">
                  {' '}
                  → {draft.subfolders.map((s) => `${preview ? preview + '/' : ''}${s}`).join('  ')}
                </span>
              )}
            </code>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={save}>{draft.builtin ? 'Als Kopie speichern' : 'Speichern'}</Button>
            {!draft.builtin && (
              <Button
                variant="destructive"
                onClick={() => state.remove(draft.id)}
                uppercase={false}
              >
                Löschen
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[11px] uppercase tracking-[0.12em] font-bold text-[var(--muted-foreground)] mb-1.5">
      {children}
    </span>
  );
}

function TokenRow({
  label,
  tokens,
  onInsert,
}: {
  label: string;
  tokens: typeof ALL_TOKENS;
  onInsert: (key: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wide font-bold text-[var(--muted-foreground)] w-16">
        {label}
      </span>
      {tokens.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onInsert(t.key)}
          title={t.label}
          className="font-mono text-xs px-2 py-1 rounded-[var(--radius)] border border-[var(--border)]
                     hover:bg-[var(--highlight)] transition-colors"
        >
          {`{${t.key}}`}
        </button>
      ))}
    </div>
  );
}
