import { useTemplates, allTemplates, findTemplate } from '@/store/templates';
import { usedProjectTokens } from '@shared/template';
import { cn } from '@jm/ui';

interface Props {
  onManage?: () => void;
}

/** Template chooser + project-field inputs. Reads/writes the templates store. */
export function MasterFolderControls({ onManage }: Props) {
  const state = useTemplates();
  const templates = allTemplates(state);
  const selected = findTemplate(state, state.selectedId) ?? templates[0];
  const fieldTokens = selected ? usedProjectTokens(selected.pattern) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <label className="flex-1 block">
          <span className="block text-[11px] uppercase tracking-[0.12em] font-bold text-[var(--muted-foreground)] mb-1.5">
            Master-Ordner-Vorlage
          </span>
          <select
            value={selected?.id ?? ''}
            onChange={(e) => state.setSelected(e.target.value)}
            className={cn(
              'h-10 w-full rounded-[var(--radius)] px-3 text-sm font-semibold',
              'bg-[var(--input)] border border-[var(--border)] text-[var(--foreground)]',
              'focus-visible:outline-2 focus-visible:outline-[var(--ring)]',
            )}
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.builtin ? '★ ' : ''}
                {t.name}
              </option>
            ))}
          </select>
        </label>
        {onManage && (
          <button
            type="button"
            onClick={onManage}
            className="h-10 px-3 text-xs font-bold uppercase tracking-wide rounded-[var(--radius)]
                       border border-[var(--border)] hover:bg-[var(--highlight)] transition-colors"
          >
            Bearbeiten
          </button>
        )}
      </div>

      {selected && (
        <div className="text-xs text-[var(--muted-foreground)]">
          Muster:{' '}
          <code className="text-[var(--foreground)] bg-[var(--muted)] px-1.5 py-0.5 rounded">
            {selected.pattern || '(leer)'}
          </code>
          {selected.subfolders.length > 0 && (
            <>
              {' · '}Unterordner:{' '}
              <span className="text-[var(--foreground)]">{selected.subfolders.join(' / ')}</span>
            </>
          )}
        </div>
      )}

      {fieldTokens.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {fieldTokens.map((tok) => (
            <label key={tok.key} className="block">
              <span className="block text-[11px] uppercase tracking-[0.1em] font-bold text-[var(--muted-foreground)] mb-1">
                {tok.label}
              </span>
              <input
                value={state.fields[tok.key] ?? ''}
                onChange={(e) => state.setField(tok.key, e.target.value)}
                placeholder={tok.example}
                className={cn(
                  'h-9 w-full rounded-[var(--radius)] px-3 text-sm',
                  'bg-[var(--input)] border border-[var(--border)] text-[var(--foreground)]',
                  'placeholder:text-[var(--muted-foreground)]',
                  'focus-visible:outline-2 focus-visible:outline-[var(--ring)]',
                )}
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
