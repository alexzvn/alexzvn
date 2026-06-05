import { useState } from 'react';
import { useApp } from '@/store/app';
import { useSession } from '@/store/session';
import { Button } from '@jm/ui';
import { Input } from '@/components/ui/Input';
import { emitWithAck } from '@/sync/client';
import { EVENTS } from '@shared/protocol';
import { canDo } from '@shared/roles';
import type { Device, DeviceKind } from '@shared/device';

const KIND_LABEL: Record<DeviceKind, string> = {
  tricaster: 'TriCaster',
  'panasonic-ptz': 'PTZ Cam',
  'panasonic-rp': 'PTZ Controller',
  'aja-kumo': 'AjA Kumo',
  ultimatte: 'Ultimatte',
  'artnet-node': 'Artnet Node',
  switch: 'Switch',
  taktgenerator: 'Taktgenerator',
  unknown: 'Sonstiges',
};

const KINDS: DeviceKind[] = [
  'tricaster',
  'panasonic-ptz',
  'panasonic-rp',
  'aja-kumo',
  'ultimatte',
  'artnet-node',
  'switch',
  'taktgenerator',
  'unknown',
];

export function DeviceTable() {
  const devices = useApp((s) => s.devices);
  const role = useSession((s) => s.user?.role);
  const canEdit = role ? canDo(role, 'inventory:write') : false;
  const [editing, setEditing] = useState<string | null>(null);

  async function save(d: Device): Promise<void> {
    await emitWithAck(EVENTS.INVENTORY_UPSERT, { device: d });
    setEditing(null);
  }

  async function remove(id: string): Promise<void> {
    if (!confirm('Gerät wirklich entfernen?')) return;
    await emitWithAck(EVENTS.INVENTORY_REMOVE, { id });
  }

  return (
    <div>
      <div className="grid grid-cols-[140px_1.5fr_1fr_140px_1fr_auto] gap-3 px-2 py-2 text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)] border-b border-[var(--border)]/40">
        <div>Typ</div>
        <div>Name / Alias</div>
        <div>IP</div>
        <div>MAC</div>
        <div>Hersteller / Modell</div>
        <div></div>
      </div>
      {devices.length === 0 ? (
        <p className="px-2 py-6 text-sm text-[var(--muted-foreground)]">
          Noch keine Geräte. Wechsle zum <b>Discovery</b>-Tab oder füge manuell hinzu.
        </p>
      ) : (
        devices.map((d) =>
          editing === d.id ? (
            <EditRow key={d.id} device={d} onSave={save} onCancel={() => setEditing(null)} />
          ) : (
            <div
              key={d.id}
              className="grid grid-cols-[140px_1.5fr_1fr_140px_1fr_auto] gap-3 items-center px-2 py-3 border-b border-[var(--border)]/20 hover:bg-[var(--highlight)]/30"
            >
              <div className="text-xs">{KIND_LABEL[d.kind]}</div>
              <div className="text-sm font-semibold">
                {d.alias || d.name}
                {d.alias && (
                  <span className="ml-2 text-[10px] text-[var(--muted-foreground)]">({d.name})</span>
                )}
              </div>
              <div className="text-sm tabular-nums">{d.ip}</div>
              <div className="text-xs text-[var(--muted-foreground)] tabular-nums">{d.mac ?? '—'}</div>
              <div className="text-xs text-[var(--muted-foreground)]">
                {d.vendor ?? '—'} {d.model && `· ${d.model}`}
              </div>
              <div className="flex gap-1">
                {canEdit && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setEditing(d.id)}>
                      Bearbeiten
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => remove(d.id)}>
                      Entfernen
                    </Button>
                  </>
                )}
              </div>
            </div>
          ),
        )
      )}

      {canEdit && (
        <div className="mt-4">
          <NewRow onSave={save} />
        </div>
      )}
    </div>
  );
}

function EditRow({
  device,
  onSave,
  onCancel,
}: {
  device: Device;
  onSave: (d: Device) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Device>(device);
  return (
    <div className="grid grid-cols-[140px_1.5fr_1fr_140px_1fr_auto] gap-3 items-center px-2 py-3 bg-[var(--highlight)]/30 border-b border-[var(--border)]/40">
      <select
        value={draft.kind}
        onChange={(e) => setDraft({ ...draft, kind: e.target.value as DeviceKind })}
        className="h-9 px-2 rounded-[var(--radius)] bg-[var(--input)] border border-[var(--border)] text-xs"
      >
        {KINDS.map((k) => (
          <option key={k} value={k}>
            {KIND_LABEL[k]}
          </option>
        ))}
      </select>
      <Input value={draft.alias ?? draft.name} onChange={(e) => setDraft({ ...draft, alias: e.target.value })} />
      <Input value={draft.ip} onChange={(e) => setDraft({ ...draft, ip: e.target.value })} />
      <Input value={draft.mac ?? ''} onChange={(e) => setDraft({ ...draft, mac: e.target.value || undefined })} />
      <Input value={draft.model ?? ''} onChange={(e) => setDraft({ ...draft, model: e.target.value || undefined })} />
      <div className="flex gap-1">
        <Button size="sm" onClick={() => onSave(draft)}>
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Abbr.
        </Button>
      </div>
    </div>
  );
}

function NewRow({ onSave }: { onSave: (d: Device) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Device>({
    id: '',
    kind: 'unknown',
    name: '',
    ip: '',
  });
  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        + Gerät hinzufügen
      </Button>
    );
  }
  return (
    <div className="grid grid-cols-[140px_1.5fr_1fr_140px_1fr_auto] gap-3 items-center px-2 py-3 bg-[var(--highlight)]/30 rounded">
      <select
        value={draft.kind}
        onChange={(e) => setDraft({ ...draft, kind: e.target.value as DeviceKind })}
        className="h-9 px-2 rounded-[var(--radius)] bg-[var(--input)] border border-[var(--border)] text-xs"
      >
        {KINDS.map((k) => (
          <option key={k} value={k}>
            {KIND_LABEL[k]}
          </option>
        ))}
      </select>
      <Input
        value={draft.name}
        placeholder="Name"
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
      />
      <Input
        value={draft.ip}
        placeholder="IP"
        onChange={(e) => setDraft({ ...draft, ip: e.target.value })}
      />
      <Input
        value={draft.mac ?? ''}
        placeholder="MAC"
        onChange={(e) => setDraft({ ...draft, mac: e.target.value || undefined })}
      />
      <Input
        value={draft.model ?? ''}
        placeholder="Modell"
        onChange={(e) => setDraft({ ...draft, model: e.target.value || undefined })}
      />
      <div className="flex gap-1">
        <Button
          size="sm"
          onClick={() => {
            if (!draft.name || !draft.ip) return;
            onSave({
              ...draft,
              id: `dev-${Date.now().toString(36)}`,
            });
            setOpen(false);
            setDraft({ id: '', kind: 'unknown', name: '', ip: '' });
          }}
        >
          Hinzufügen
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Abbr.
        </Button>
      </div>
    </div>
  );
}
