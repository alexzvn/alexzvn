import { useState } from 'react';
import { Button, Card, cn } from '@jm/ui';
import { useTools } from '@/store/tools';

export function SettingsModal() {
  const open = useTools((s) => s.settingsOpen);
  const settings = useTools((s) => s.settings);
  const close = useTools((s) => s.closeSettings);
  const save = useTools((s) => s.saveSettings);

  const [token, setToken] = useState('');
  const [proxy, setProxy] = useState(settings?.proxyUrl ?? '');
  const [manifestUrl, setManifestUrl] = useState(settings?.manifestUrl ?? '');

  if (!open) return null;

  const fromEnv = settings?.fromEnv ?? false;
  const manifestFromEnv = settings?.manifestFromEnv ?? false;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm px-6">
      <Card className="w-full max-w-lg p-6 jm-fade-in">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight">Einstellungen</h2>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">
              Quelle für Download &amp; Auto-Update der Tools.
            </p>
          </div>
          <SourceBadge source={settings?.source ?? 'none'} />
        </div>

        {fromEnv && (
          <p className="mt-4 text-xs rounded-[var(--radius)] border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-[var(--muted-foreground)]">
            Quelle wird per Umgebungsvariable gesetzt und kann hier nicht überschrieben werden.
          </p>
        )}

        <div className={cn('mt-5 flex flex-col gap-4', fromEnv && 'opacity-50 pointer-events-none')}>
          <Field
            label="GitHub-Token (fine-grained PAT, read-only contents)"
            placeholder={settings?.hasToken ? '•••••••••• (gesetzt)' : 'ghp_… / github_pat_…'}
            type="password"
            value={token}
            onChange={setToken}
          />
          <Field
            label="Interner Proxy (optional, hat Vorrang vor Token)"
            placeholder="https://releases.intern.jakobsmedien.de"
            value={proxy}
            onChange={setProxy}
          />
        </div>

        <div className="mt-5 border-t border-[var(--border)] pt-5">
          <p className="text-xs text-[var(--muted-foreground)] mb-3">
            Remote-Katalog (suite.json): zentrale Liste der Tools/Texte. Leer = gebündelter
            Katalog. Änderung wirkt beim nächsten Start.
          </p>
          {manifestFromEnv && (
            <p className="mb-3 text-xs rounded-[var(--radius)] border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-[var(--muted-foreground)]">
              Katalog-URL wird per Umgebungsvariable gesetzt und kann hier nicht überschrieben
              werden.
            </p>
          )}
          <div className={cn(manifestFromEnv && 'opacity-50 pointer-events-none')}>
            <Field
              label="Katalog-URL (optional)"
              placeholder="https://suite.intern.jakobsmedien.de/suite.json"
              value={manifestUrl}
              onChange={setManifestUrl}
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="ghost" onClick={close}>
            Abbrechen
          </Button>
          <Button
            variant="primary"
            onClick={() =>
              save({
                ...(fromEnv ? {} : { githubToken: token, proxyUrl: proxy }),
                ...(manifestFromEnv ? {} : { manifestUrl }),
              })
            }
          >
            Speichern
          </Button>
        </div>
      </Card>
    </div>
  );
}

function SourceBadge({ source }: { source: 'github' | 'proxy' | 'none' }) {
  const label = source === 'github' ? 'GitHub' : source === 'proxy' ? 'Proxy' : 'Keine Quelle';
  return (
    <span
      className={cn(
        'shrink-0 rounded-[var(--radius-full)] border px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.12em]',
        source === 'none'
          ? 'border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)]'
          : 'border-[var(--success)]/40 bg-[var(--success)]/12 text-[var(--success)]',
      )}
    >
      {label}
    </span>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] uppercase tracking-[0.12em] font-extrabold text-[var(--muted-foreground)]">
        {label}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-10 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)]',
          'px-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]',
          'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]',
        )}
      />
    </label>
  );
}
