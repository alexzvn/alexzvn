import { useState } from 'react';
import { Card } from '@jm/ui';
import { Button } from '@jm/ui';
import { Input } from '@/components/ui/Input';
import { Headline } from '@/components/ui/Headline';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Logo } from '@jm/ui';
import { useSession } from '@/store/session';
import { apiFetch } from '@/sync/client';
import type { SessionUser } from '@shared/protocol';

export function LoginView() {
  const setSession = useSession((s) => s.setSession);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ token: string; user: SessionUser }>('/api/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      setSession(res.token, res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full flex items-center justify-center bg-[var(--background)] p-6">
      <Card className="w-full max-w-md p-8">
        <div className="flex items-center gap-3 mb-6">
          <Logo size={32} />
          <div>
            <Headline variant="subsection">JM Studio Control</Headline>
            <SectionHeader>Anmelden</SectionHeader>
          </div>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
            Benutzer
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
            Passwort
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error && (
            <p className="text-xs text-[var(--destructive)] uppercase tracking-wide font-bold">
              {error === '401: {"error":"invalid_credentials"}' ? 'Falsche Zugangsdaten' : error}
            </p>
          )}
          <Button type="submit" disabled={busy} className="mt-2">
            {busy ? 'Anmelden …' : 'Anmelden'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
