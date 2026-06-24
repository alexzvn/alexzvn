import { useMemo, useState } from 'react';
import { Card, Button, cn } from '@jm/ui';
import { Input } from '@/components/ui/Input';
import { Headline } from '@/components/ui/Headline';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { StatusPill } from '@/components/ui/StatusPill';
import { useApp } from '@/store/app';
import { useSession } from '@/store/session';
import { emitWithAck, apiFetch } from '@/sync/client';
import { EVENTS, type AtemStatusEvent } from '@shared/protocol';
import type { AtemCommand, AtemConfig } from '@shared/atem';
import { canDo } from '@shared/roles';

const INPUTS = [1, 2, 3, 4, 5, 6, 7, 8];

/** Steuert einen Blackmagic-ATEM (M/E 1) über die studio-control-Bridge. */
export function AtemPanel() {
  const atem = useApp((s) => s.atem);
  const statuses = useApp((s) => s.atemStatuses);
  const role = useSession((s) => s.user?.role);
  const token = useSession((s) => s.token);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);

  const current = useMemo(() => atem.find((a) => a.id === selectedId) ?? atem[0], [atem, selectedId]);
  const status = current ? statuses[current.id] : undefined;
  const live = status?.state === 'connected';

  const canExec = role ? canDo(role, 'atem:exec') : false;
  const canManage = role ? canDo(role, 'inventory:write') : false;

  async function exec(command: AtemCommand): Promise<void> {
    if (!current) return;
    try {
      await emitWithAck(EVENTS.ATEM_EXEC, { atemId: current.id, command });
    } catch (err) {
      console.warn('atem exec failed', err);
    }
  }

  async function save(cfg: AtemConfig): Promise<void> {
    await apiFetch('/api/atem', { method: 'POST', token, body: JSON.stringify(cfg) });
    setAdding(false);
    setEditing(false);
    setSelectedId(cfg.id);
  }
  async function remove(id: string): Promise<void> {
    if (!confirm('ATEM-Instanz wirklich entfernen?')) return;
    await apiFetch(`/api/atem/${encodeURIComponent(id)}`, { method: 'DELETE', token });
    setEditing(false);
    setSelectedId(null);
  }

  return (
    <Card className="p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <SectionHeader>Video · ATEM</SectionHeader>
          <Headline variant="section" className="mt-2">
            Blackmagic-Mischer
          </Headline>
        </div>
        <div className="flex items-center gap-3">
          {current && (
            <>
              <select
                value={current.id}
                onChange={(e) => setSelectedId(e.target.value)}
                className="h-10 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm"
              >
                {atem.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.host})
                  </option>
                ))}
              </select>
              <Badge status={status} />
              {canManage && (
                <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)}>
                  {editing ? 'Schließen' : 'Bearbeiten'}
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {current && status?.state === 'down' && status.lastError && (
        <div className="mb-4 rounded-[var(--radius)] border border-[var(--destructive)]/50 bg-[var(--destructive)]/10 px-3 py-2 text-xs">
          <span className="font-extrabold uppercase tracking-wider text-[var(--destructive)]">Verbindung fehlgeschlagen:</span>{' '}
          <span className="text-[var(--foreground)]">{status.lastError}</span>
        </div>
      )}

      {current && editing && canManage && (
        <div className="mb-6 rounded-[var(--radius)] border border-[var(--border)]/60 bg-[var(--card)]/40 p-4">
          <AtemForm initial={current} onSubmit={save} onCancel={() => setEditing(false)} onDelete={() => remove(current.id)} />
        </div>
      )}

      {!current ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-[var(--muted-foreground)]">Noch kein ATEM konfiguriert.</p>
          {canManage ? (
            adding ? (
              <AtemForm onSubmit={save} onCancel={() => setAdding(false)} />
            ) : (
              <Button onClick={() => setAdding(true)}>ATEM hinzufügen</Button>
            )
          ) : (
            <p className="text-xs text-[var(--muted-foreground)]">Ein Admin/Operator kann im Setup einen ATEM anlegen.</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <BusRow
            label="Program"
            tone="program"
            current={status?.program}
            disabled={!canExec || !live}
            onPick={(input) => exec({ type: 'program', input })}
          />
          <BusRow
            label="Preview"
            tone="preview"
            current={status?.preview}
            disabled={!canExec || !live}
            onPick={(input) => exec({ type: 'preview', input })}
          />

          <div className="flex flex-wrap gap-2">
            <Button size="lg" variant="primary" disabled={!canExec || !live} onClick={() => exec({ type: 'cut' })} className="min-w-[110px]">
              Cut
            </Button>
            <Button size="lg" variant="accent" disabled={!canExec || !live} onClick={() => exec({ type: 'auto' })} className="min-w-[110px]">
              Auto
            </Button>
            <Button size="lg" variant="destructive" disabled={!canExec || !live} onClick={() => exec({ type: 'ftb' })} className="min-w-[110px]">
              FTB
            </Button>
            <Button
              size="lg"
              variant={status?.recording ? 'destructive' : 'outline'}
              disabled={!canExec || !live}
              onClick={() => exec({ type: 'record', on: !status?.recording })}
              className="min-w-[110px]"
            >
              {status?.recording ? '● REC' : 'REC'}
            </Button>
            <Button
              size="lg"
              variant={status?.streaming ? 'accent' : 'outline'}
              disabled={!canExec || !live}
              onClick={() => exec({ type: 'stream', on: !status?.streaming })}
              className="min-w-[110px]"
            >
              {status?.streaming ? '● STREAM' : 'STREAM'}
            </Button>
          </div>

          {canManage && !adding && (
            <div className="border-t border-[var(--border)]/40 pt-4">
              <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
                Weitere Instanz
              </Button>
            </div>
          )}
          {canManage && adding && (
            <div className="border-t border-[var(--border)]/40 pt-4">
              <AtemForm onSubmit={save} onCancel={() => setAdding(false)} />
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function BusRow({
  label,
  tone,
  current,
  disabled,
  onPick,
}: {
  label: string;
  tone: 'program' | 'preview';
  current?: number;
  disabled: boolean;
  onPick: (input: number) => void;
}) {
  const active = tone === 'program' ? 'var(--destructive)' : 'var(--accent, #2dd4bf)';
  return (
    <div>
      <div className="mb-1.5 text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">{label}</div>
      <div className="flex flex-wrap gap-2">
        {INPUTS.map((n) => {
          const on = current === n;
          return (
            <button
              key={n}
              disabled={disabled}
              onClick={() => onPick(n)}
              className={cn(
                'h-11 w-12 rounded-[var(--radius)] border text-sm font-bold tabular-nums disabled:opacity-40',
                on ? 'text-white' : 'border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)]/30',
              )}
              style={on ? { background: active, borderColor: active } : undefined}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Badge({ status }: { status: AtemStatusEvent | undefined }) {
  if (!status) return <StatusPill status="info">Idle</StatusPill>;
  if (status.state === 'connected') return <StatusPill status="live">{status.model ?? 'Verbunden'}</StatusPill>;
  if (status.state === 'connecting') return <StatusPill status="setup">Verbinde …</StatusPill>;
  return (
    <span title={status.lastError ?? 'Offline'}>
      <StatusPill status="error">Offline</StatusPill>
    </span>
  );
}

function AtemForm({
  initial,
  onSubmit,
  onCancel,
  onDelete,
}: {
  initial?: AtemConfig;
  onSubmit: (cfg: AtemConfig) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? 'ATEM Mini');
  const [host, setHost] = useState(initial?.host ?? '');
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!host || !name) return;
        setBusy(true);
        try {
          await onSubmit({ id: initial?.id ?? `atem-${Date.now().toString(36)}`, name, host });
        } finally {
          setBusy(false);
        }
      }}
      className="flex flex-wrap items-end gap-2"
    >
      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
        Name
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
        Host / IP
        <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="192.168.10.20" required />
      </label>
      <Button type="submit" disabled={busy}>
        Speichern
      </Button>
      <Button type="button" variant="ghost" onClick={onCancel}>
        Abbrechen
      </Button>
      {onDelete && (
        <Button type="button" variant="destructive" onClick={onDelete}>
          Entfernen
        </Button>
      )}
    </form>
  );
}
