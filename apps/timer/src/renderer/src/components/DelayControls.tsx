import { useState } from 'react';
import { useStore } from '@/store/timer';
import { Button } from '@jm/ui';
import { Input } from './ui/Input';
import { Card } from '@jm/ui';
import { SectionHeader } from './ui/SectionHeader';
import { formatHMS } from '@/lib/time';

const QUICK_STEPS_SEC = [-300, -60, -30, 30, 60, 300];

function formatSignedHMS(ms: number): string {
  if (ms === 0) return '00:00:00';
  const sign = ms > 0 ? '+' : '-';
  return `${sign}${formatHMS(Math.abs(ms))}`;
}

export function DelayControls() {
  const delayMs = useStore((s) => s.countdown.delayMs);
  const addDelay = useStore((s) => s.addDelay);
  const clearDelay = useStore((s) => s.clearDelay);

  const [customSec, setCustomSec] = useState('60');
  const [error, setError] = useState<string | null>(null);
  const [pendingSign, setPendingSign] = useState<1 | -1>(1);

  function applyCustom() {
    const sec = Number(customSec);
    if (!Number.isFinite(sec) || sec <= 0) {
      setError('Bitte eine positive Zahl in Sekunden eintragen.');
      return;
    }
    setError(null);
    addDelay(Math.round(sec) * pendingSign);
  }

  const delaySec = Math.round(delayMs / 1000);

  return (
    <Card variant="nested" className="w-full max-w-[640px]">
      <div className="p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <SectionHeader>Delay · Live</SectionHeader>
          <div
            className="text-sm font-extrabold tabular tracking-wide"
            style={{
              color:
                delayMs > 0
                  ? 'var(--destructive)'
                  : delayMs < 0
                    ? 'var(--primary)'
                    : 'var(--muted-foreground)',
            }}
            title={`${delaySec >= 0 ? '+' : ''}${delaySec} s`}
          >
            {formatSignedHMS(delayMs)}
          </div>
        </div>

        <div className="grid grid-cols-6 gap-2">
          {QUICK_STEPS_SEC.map((sec) => (
            <Button
              key={sec}
              variant={sec > 0 ? 'accent' : 'outline'}
              size="sm"
              uppercase={false}
              onClick={() => addDelay(sec)}
              className="font-bold"
            >
              {sec > 0 ? '+' : '−'}
              {formatStep(Math.abs(sec))}
            </Button>
          ))}
        </div>

        <div className="flex items-end gap-3">
          <div className="flex flex-col">
            <label className="block text-xs uppercase tracking-[0.12em] text-[var(--muted-foreground)] mb-2">
              Richtung
            </label>
            <div className="flex rounded-[var(--radius)] overflow-hidden border border-[var(--border)]">
              <button
                type="button"
                onClick={() => setPendingSign(1)}
                aria-label="Verspätung hinzufügen"
                className={`h-10 px-3 text-sm font-extrabold uppercase tracking-wide transition-colors ${
                  pendingSign === 1
                    ? 'bg-[var(--accent)] text-[var(--foreground)]'
                    : 'bg-transparent text-[var(--muted-foreground)] hover:bg-[var(--highlight)]'
                }`}
              >
                +
              </button>
              <button
                type="button"
                onClick={() => setPendingSign(-1)}
                aria-label="Zeit aufholen"
                className={`h-10 px-3 text-sm font-extrabold uppercase tracking-wide transition-colors ${
                  pendingSign === -1
                    ? 'bg-[var(--accent)] text-[var(--foreground)]'
                    : 'bg-transparent text-[var(--muted-foreground)] hover:bg-[var(--highlight)]'
                }`}
              >
                −
              </button>
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-xs uppercase tracking-[0.12em] text-[var(--muted-foreground)] mb-2">
              Custom · Sekunden
            </label>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={customSec}
              onChange={(e) => setCustomSec(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  applyCustom();
                }
              }}
              placeholder="60"
              className="font-extrabold"
            />
          </div>
          <Button variant="primary" size="md" onClick={applyCustom}>
            Anwenden
          </Button>
        </div>

        {error && <div className="text-xs text-[var(--destructive)]">{error}</div>}

        {delayMs !== 0 && (
          <div className="flex justify-end pt-1">
            <Button variant="ghost" size="sm" uppercase={false} onClick={clearDelay}>
              Delay zurücksetzen
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

function formatStep(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s === 0 ? `${m}m` : `${m}:${s.toString().padStart(2, '0')}`;
}
