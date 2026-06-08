import { Badge } from '@jm/ui';
import type { JmNdiStatus, SendState } from '@shared/types';
import type { CaptureStats } from '../core/capture';

const STATE_TONE: Record<SendState, 'muted' | 'warning' | 'success'> = {
  idle: 'muted',
  starting: 'warning',
  sending: 'success',
  error: 'warning',
};

const STATE_LABEL: Record<SendState, string> = {
  idle: 'Bereit',
  starting: 'Startet…',
  sending: 'Aktiv',
  error: 'Fehler',
};

interface Props {
  status: JmNdiStatus;
  stats: CaptureStats | null;
}

export function StatusBar({ status, stats }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--muted-foreground)]">
      <Badge tone={STATE_TONE[status.sendState]}>{STATE_LABEL[status.sendState]}</Badge>
      {status.ndiSourceName ? (
        <span className="font-semibold text-[var(--foreground)]">{status.ndiSourceName}</span>
      ) : null}
      {stats ? <span>{stats.width}×{stats.height}</span> : null}
      {stats ? <span>{stats.fps} fps</span> : null}
      {status.audioEnabled ? <span>Audio</span> : null}
      {status.sendState === 'sending' && typeof status.connections === 'number' ? (
        <span title="Verbundene NDI-Empfänger">{status.connections} Empfänger</span>
      ) : null}
      <span className="ml-auto italic">
        {status.error ?? (status.sendState === 'sending' ? 'NDI-Versand läuft' : 'Bereit')}
      </span>
    </div>
  );
}
