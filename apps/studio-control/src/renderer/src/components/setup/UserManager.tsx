import { useEffect, useState } from 'react';
import { useApp } from '@/store/app';
import { useSession } from '@/store/session';
import { Button } from '@jm/ui';
import { Input } from '@/components/ui/Input';
import { apiFetch } from '@/sync/client';
import type { Role } from '@shared/roles';
import type { UserRow } from '@/types/admin';

const ROLES: Role[] = ['admin', 'operator', 'viewer'];

export function UserManager() {
  const users = useApp((s) => s.users);
  const setUsers = useApp((s) => s.setUsers);
  const token = useSession((s) => s.token);
  const me = useSession((s) => s.user);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh(): Promise<void> {
    try {
      const res = await apiFetch<{ users: UserRow[] }>('/api/users', { token });
      setUsers(res.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function create(username: string, password: string, role: Role): Promise<void> {
    setError(null);
    try {
      await apiFetch('/api/users', {
        method: 'POST',
        token,
        body: JSON.stringify({ username, password, role }),
      });
      await refresh();
      setAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function updateRole(id: number, role: Role): Promise<void> {
    await apiFetch(`/api/users/${id}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ role }),
    });
    await refresh();
  }

  async function resetPassword(id: number): Promise<void> {
    const pw = prompt('Neues Passwort (min. 6 Zeichen)');
    if (!pw || pw.length < 6) return;
    await apiFetch(`/api/users/${id}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ password: pw }),
    });
  }

  async function remove(id: number): Promise<void> {
    if (id === me?.id) {
      alert('Du kannst dich nicht selbst löschen.');
      return;
    }
    if (!confirm('Benutzer wirklich löschen?')) return;
    await apiFetch(`/api/users/${id}`, { method: 'DELETE', token });
    await refresh();
  }

  return (
    <div>
      {error && <p className="text-xs text-[var(--destructive)] mb-3">{error}</p>}
      <div className="grid grid-cols-[1.5fr_120px_140px_auto] gap-3 px-2 py-2 text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)] border-b border-[var(--border)]/40">
        <div>Benutzer</div>
        <div>Rolle</div>
        <div>Erstellt</div>
        <div></div>
      </div>
      {users.map((u) => (
        <div
          key={u.id}
          className="grid grid-cols-[1.5fr_120px_140px_auto] gap-3 items-center px-2 py-3 border-b border-[var(--border)]/20"
        >
          <div className="text-sm font-semibold">{u.username}</div>
          <select
            value={u.role}
            onChange={(e) => updateRole(u.id, e.target.value as Role)}
            disabled={u.id === me?.id}
            className="h-9 px-2 rounded-[var(--radius)] bg-[var(--input)] border border-[var(--border)] text-xs"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <span className="text-xs text-[var(--muted-foreground)] tabular-nums">
            {new Date(u.created_at).toLocaleDateString('de-DE')}
          </span>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => resetPassword(u.id)}>
              Passwort
            </Button>
            <Button size="sm" variant="ghost" onClick={() => remove(u.id)} disabled={u.id === me?.id}>
              Löschen
            </Button>
          </div>
        </div>
      ))}
      <div className="mt-4">
        {adding ? (
          <AddUserForm onCreate={create} onCancel={() => setAdding(false)} />
        ) : (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            + Benutzer anlegen
          </Button>
        )}
      </div>
    </div>
  );
}

function AddUserForm({
  onCreate,
  onCancel,
}: {
  onCreate: (username: string, password: string, role: Role) => Promise<void>;
  onCancel: () => void;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('operator');
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        await onCreate(username, password, role);
      }}
      className="flex items-end gap-2 flex-wrap"
    >
      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
        Benutzer
        <Input value={username} onChange={(e) => setUsername(e.target.value)} required />
      </label>
      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
        Passwort
        <Input
          type="password"
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
        Rolle
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="h-10 px-3 rounded-[var(--radius)] bg-[var(--input)] border border-[var(--border)] text-sm"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit">Anlegen</Button>
      <Button type="button" variant="ghost" onClick={onCancel}>
        Abbrechen
      </Button>
    </form>
  );
}
