import { useEffect, useState } from 'react';
import { Button, Card, cn } from '@jm/ui';
import type { PresenceRecord } from '@shared/types';
import { useTools } from '@/store/tools';

// Spiegelt STALE_MS aus dem Presence-Hub: ohne Lebenszeichen gilt ein Tool
// nach dieser Zeit lokal als gestoppt (snappige Anzeige bis zum Hub-Event).
const STALE_MS = 25_000;

export function SystemStatusModal() {
  const open = useTools((s) => s.systemOpen);
  const presence = useTools((s) => s.presence);
  const states = useTools((s) => s.states);
  const close = useTools((s) => s.closeSystem);
  const reload = useTools((s) => s.loadPresence);

  // Sekündlich neu rendern, damit „vor X s" tickt und Stale-Tools umklappen.
  const [, force] = useState(0);
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [open]);

  if (!open) return null;

  const now = Date.now();
  const isLive = (r: PresenceRecord) => r.running && now - r.lastSeen < STALE_MS;
  const runningCount = presence.filter(isLive).length;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm px-6">
      <Card className="w-full max-w-lg p-6 jm-fade-in">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight">System-Zustand</h2>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">
              {presence.length === 0
                ? 'Noch keine Tool-Rückmeldungen.'
                : `${runningCount} von ${presence.length} Tools laufen gerade.`}
            </p>
          </div>
          <span
            className={cn(
              'shrink-0 rounded-[var(--radius-full)] border px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.12em]',
              runningCount > 0
                ? 'border-[var(--success)]/40 bg-[var(--success)]/12 text-[var(--success)]'
                : 'border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)]',
            )}
          >
            {runningCount > 0 ? 'Live' : 'Idle'}
          </span>
        </div>

        {presence.length === 0 ? (
          <p className="mt-5 text-sm rounded-[var(--radius)] border border-[var(--border)] bg-[var(--muted)] px-3 py-3 text-[var(--muted-foreground)]">
            Sobald ein Tool aus der Suite gestartet wird, meldet es sich hier mit
            Status, Version und letzter Aktivität. Bereits laufende Tools melden
            sich beim nächsten Heartbeat.
          </p>
        ) : (
          <ul className="mt-5 flex flex-col gap-2 max-h-[60vh] overflow-auto">
            {presence.map((r) => (
              <Row
                key={r.appId}
                rec={r}
                live={isLive(r)}
                now={now}
                updateAvailable={states[r.appId]?.status === 'update-available'}
              />
            ))}
          </ul>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="ghost" onClick={() => void reload()}>
            Aktualisieren
          </Button>
          <Button variant="primary" onClick={close}>
            Schließen
          </Button>
        </div>
      </Card>
    </div>
  );
}

function Row({
  rec,
  live,
  now,
  updateAvailable,
}: {
  rec: PresenceRecord;
  live: boolean;
  now: number;
  updateAvailable: boolean;
}) {
  return (
    <li className="flex items-start gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2.5">
      <span
        aria-hidden
        className={cn(
          'mt-1 size-2.5 shrink-0 rounded-full',
          live
            ? 'bg-[var(--success)] animate-pulse'
            : 'bg-[var(--muted-foreground)]/40',
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold truncate">{rec.name}</span>
          <span className="text-[10px] tabular-nums text-[var(--muted-foreground)]">
            v{rec.version}
          </span>
          {updateAvailable && (
            <span className="rounded-[var(--radius-full)] border border-[var(--primary)]/40 bg-[var(--highlight)] px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-[var(--primary)]">
              Update
            </span>
          )}
          {rec.servicePort && (
            <span className="text-[10px] tabular-nums text-[var(--muted-foreground)]">
              :{rec.servicePort}
            </span>
          )}
        </div>
        <div className="mt-0.5 text-xs text-[var(--muted-foreground)]">
          {live ? 'läuft' : 'gestoppt'} · {relTime(now - rec.lastSeen)}
        </div>
        {rec.lastCrash && (
          <div className="mt-1 text-[11px] text-[var(--destructive)]">
            ⚠ letzter Absturz ({rec.lastCrash.kind}) · {shortDate(rec.lastCrash.at)}
          </div>
        )}
      </div>
    </li>
  );
}

/** Menschliche Relativzeit für „zuletzt gesehen": vor X s / min / h. */
function relTime(deltaMs: number): string {
  const s = Math.max(0, Math.round(deltaMs / 1000));
  if (s < 60) return `vor ${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `vor ${m} min`;
  const h = Math.round(m / 60);
  return `vor ${h} h`;
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}
