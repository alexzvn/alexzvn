import { Badge, Button, Card } from '@jm/ui';
import type { ToolManifest, ToolState } from '@shared/types';
import { monogram } from '@/lib/monogram';
import { useTools } from '@/store/tools';

interface Props {
  tool: ToolManifest;
  state?: ToolState;
}

export function ToolCard({ tool, state }: Props) {
  const status = state?.status ?? 'not-installed';
  const busy = useTools((s) => s.busy[tool.id] ?? false);
  const open = useTools((s) => s.open);
  const install = useTools((s) => s.install);
  const update = useTools((s) => s.update);

  return (
    <Card className="h-full p-5 flex flex-col gap-4 jm-fade-in">
      <div className="flex items-start gap-4">
        <div
          className="grid place-items-center size-12 shrink-0 rounded-[var(--radius-lg)]
                     border border-[var(--primary)]/40 bg-[var(--highlight)]
                     text-lg font-extrabold tracking-tight text-[var(--primary)]"
          aria-hidden
        >
          {monogram(tool.name)}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-extrabold leading-tight truncate">{tool.name}</h3>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--muted-foreground)] mt-0.5">
            {tool.tagline}
          </p>
        </div>
        <StatusBadge status={status} />
      </div>

      <p className="text-sm leading-snug text-[var(--foreground)]/80 flex-1">
        {tool.description}
      </p>

      <div className="flex items-center justify-between gap-3 pt-1">
        <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
          v{tool.latestVersion} · {tool.category}
        </span>
        <Actions
          status={status}
          busy={busy}
          onOpen={() => open(tool.id)}
          onInstall={() => install(tool.id)}
          onUpdate={() => update(tool.id)}
        />
      </div>
    </Card>
  );
}

function StatusBadge({ status }: { status: ToolState['status'] }) {
  if (status === 'installed') return <Badge tone="success">Installiert</Badge>;
  if (status === 'update-available') return <Badge tone="warning">Update</Badge>;
  return <Badge tone="muted">Nicht installiert</Badge>;
}

function Actions({
  status,
  busy,
  onOpen,
  onInstall,
  onUpdate,
}: {
  status: ToolState['status'];
  busy: boolean;
  onOpen: () => void;
  onInstall: () => void;
  onUpdate: () => void;
}) {
  if (status === 'installed') {
    return (
      <Button size="sm" variant="primary" disabled={busy} onClick={onOpen}>
        Öffnen
      </Button>
    );
  }
  if (status === 'update-available') {
    return (
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={onOpen}>
          Öffnen
        </Button>
        <Button size="sm" variant="primary" disabled={busy} onClick={onUpdate}>
          Update
        </Button>
      </div>
    );
  }
  return (
    <Button size="sm" variant="outline" disabled={busy} onClick={onInstall}>
      Installieren
    </Button>
  );
}
