import { useMemo, useRef, useState } from 'react';
import { Card, Button, cn } from '@jm/ui';
import { Input } from '@/components/ui/Input';
import { Headline } from '@/components/ui/Headline';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { StatusPill } from '@/components/ui/StatusPill';
import { useApp } from '@/store/app';
import { useSession } from '@/store/session';
import { emitWithAck, apiFetch } from '@/sync/client';
import { EVENTS, type PtzStatusEvent } from '@shared/protocol';
import {
  DEFAULT_PTZ_PORT,
  PTZ_PRESET_COUNT,
  PTZ_SPEEDS,
  PTZ_STOP,
  type PtzAction,
  type PtzCameraConfig,
  type PtzSpeed,
} from '@shared/ptz';
import { canDo } from '@shared/roles';

// 3×3 direction grid (centre = stop). Sign × selected speed → AW drive value.
const DIRS: Array<{ key: string; pan: number; tilt: number; label: string }> = [
  { key: 'ul', pan: -1, tilt: 1, label: '↖' },
  { key: 'u', pan: 0, tilt: 1, label: '↑' },
  { key: 'ur', pan: 1, tilt: 1, label: '↗' },
  { key: 'l', pan: -1, tilt: 0, label: '←' },
  { key: 'c', pan: 0, tilt: 0, label: '■' },
  { key: 'r', pan: 1, tilt: 0, label: '→' },
  { key: 'dl', pan: -1, tilt: -1, label: '↙' },
  { key: 'd', pan: 0, tilt: -1, label: '↓' },
  { key: 'dr', pan: 1, tilt: -1, label: '↘' },
];

const SPEED_LABELS: Record<PtzSpeed, string> = { slow: 'Langsam', med: 'Mittel', fast: 'Schnell' };

export function PtzPanel() {
  const cameras = useApp((s) => s.ptzCameras);
  const statuses = useApp((s) => s.ptzStatuses);
  const role = useSession((s) => s.user?.role);
  const token = useSession((s) => s.token);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [speed, setSpeed] = useState<PtzSpeed>('med');
  const [storeMode, setStoreMode] = useState(false);

  const current = useMemo(
    () => cameras.find((c) => c.id === selectedId) ?? cameras[0],
    [cameras, selectedId],
  );
  const status = current ? statuses[current.id] : undefined;

  const canExec = role ? canDo(role, 'ptz:exec') : false;
  const canManage = role ? canDo(role, 'inventory:write') : false;
  const live = status?.state === 'connected';
  const disabled = !canExec || !live;
  const mag = PTZ_SPEEDS[speed];

  async function exec(action: PtzAction): Promise<void> {
    if (!current) return;
    try {
      await emitWithAck(EVENTS.PTZ_EXEC, { cameraId: current.id, action });
    } catch (err) {
      console.warn('ptz exec failed', err);
    }
  }

  async function saveCamera(cfg: PtzCameraConfig): Promise<void> {
    await apiFetch('/api/ptz', { method: 'POST', token, body: JSON.stringify(cfg) });
    setAdding(false);
    setEditing(false);
    setSelectedId(cfg.id);
  }

  async function deleteCamera(id: string): Promise<void> {
    if (!confirm('PTZ-Kamera wirklich entfernen?')) return;
    await apiFetch(`/api/ptz/${encodeURIComponent(id)}`, { method: 'DELETE', token });
    setEditing(false);
    setSelectedId(null);
  }

  function onPreset(n: number): void {
    if (storeMode) {
      if (!confirm(`Aktuelle Position auf Preset ${n} speichern? Überschreibt den bisherigen Wert.`)) return;
      void exec({ kind: 'preset-store', preset: n });
    } else {
      void exec({ kind: 'preset-recall', preset: n });
    }
  }

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <SectionHeader>Video · PTZ</SectionHeader>
          <Headline variant="section" className="mt-2">
            Kameras
          </Headline>
        </div>
        <div className="flex items-center gap-3">
          {current ? (
            <>
              <select
                value={current.id}
                onChange={(e) => setSelectedId(e.target.value)}
                className="h-10 px-3 rounded-[var(--radius)] bg-[var(--input)] border border-[var(--border)] text-sm"
              >
                {cameras.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.host}:{c.port})
                  </option>
                ))}
              </select>
              <StatusBadge status={status} />
              {canManage && (
                <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)}>
                  {editing ? 'Schließen' : 'Bearbeiten'}
                </Button>
              )}
            </>
          ) : null}
        </div>
      </div>

      {current && status?.state === 'down' && status.lastError && (
        <div className="mb-4 rounded-[var(--radius)] border border-[var(--destructive)]/50 bg-[var(--destructive)]/10 px-3 py-2 text-xs">
          <span className="font-extrabold uppercase tracking-wider text-[var(--destructive)]">
            Kamera nicht erreichbar:
          </span>{' '}
          <span className="text-[var(--foreground)]">{status.lastError}</span>
          <span className="text-[var(--muted-foreground)]">
            {' '}
            — Adresse{' '}
            <code className="tabular-nums">
              http://{current.host}
              {current.port !== 80 ? `:${current.port}` : ''}/cgi-bin/aw_ptz
            </code>{' '}
            prüfen.
          </span>
        </div>
      )}

      {current && editing && canManage && (
        <div className="mb-6 rounded-[var(--radius)] border border-[var(--border)]/60 bg-[var(--card)]/40 p-4">
          <PtzForm
            initial={current}
            onSubmit={saveCamera}
            onCancel={() => setEditing(false)}
            onDelete={() => deleteCamera(current.id)}
          />
        </div>
      )}

      {!current ? (
        <div className="flex flex-col gap-3 items-start">
          <p className="text-sm text-[var(--muted-foreground)]">
            Noch keine PTZ-Kamera konfiguriert. Panasonic AW-Kameras werden im Setup-Tab via Discovery
            gefunden — hier mit ihrer IP hinzufügen.
          </p>
          {canManage ? (
            adding ? (
              <PtzForm onSubmit={saveCamera} onCancel={() => setAdding(false)} />
            ) : (
              <Button onClick={() => setAdding(true)}>Kamera hinzufügen</Button>
            )
          ) : (
            <p className="text-xs text-[var(--muted-foreground)]">
              Frage einen Admin / Operator, eine Kamera im Setup anzulegen.
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-8 items-start">
            {/* Pan / Tilt joystick + speed */}
            <div className="flex flex-col gap-3">
              <SectionHeader>Schwenk · Neige</SectionHeader>
              <div className="grid grid-cols-3 gap-1.5 w-[210px]">
                {DIRS.map((d) =>
                  d.key === 'c' ? (
                    <button
                      key={d.key}
                      type="button"
                      disabled={disabled}
                      onClick={() => void exec(PTZ_STOP)}
                      title="Stopp"
                      className={cn(driveBtn, 'text-[var(--muted-foreground)]')}
                    >
                      {d.label}
                    </button>
                  ) : (
                    <HoldButton
                      key={d.key}
                      disabled={disabled}
                      down={{ kind: 'pan-tilt', pan: d.pan * mag, tilt: d.tilt * mag }}
                      up={PTZ_STOP}
                      exec={exec}
                      className={driveBtn}
                    >
                      {d.label}
                    </HoldButton>
                  ),
                )}
              </div>
              <div className="flex gap-1 rounded-[var(--radius)] bg-[var(--input)] p-1 w-[210px]">
                {(Object.keys(PTZ_SPEEDS) as PtzSpeed[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSpeed(s)}
                    className={cn(
                      'flex-1 h-8 rounded-[var(--radius-sm)] text-[11px] uppercase tracking-wider font-extrabold transition-colors',
                      speed === s
                        ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                        : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
                    )}
                  >
                    {SPEED_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            {/* Zoom / Focus / Power */}
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-5">
                <div className="flex flex-col gap-2">
                  <SectionHeader>Zoom</SectionHeader>
                  <div className="grid grid-cols-2 gap-1.5">
                    <HoldButton disabled={disabled} exec={exec} className={driveBtn}
                      down={{ kind: 'zoom', speed: -mag }} up={{ kind: 'zoom', speed: 0 }}>
                      Wide −
                    </HoldButton>
                    <HoldButton disabled={disabled} exec={exec} className={driveBtn}
                      down={{ kind: 'zoom', speed: mag }} up={{ kind: 'zoom', speed: 0 }}>
                      Tele +
                    </HoldButton>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <SectionHeader>Fokus</SectionHeader>
                  <div className="grid grid-cols-2 gap-1.5">
                    <HoldButton disabled={disabled} exec={exec} className={driveBtn}
                      down={{ kind: 'focus', speed: -mag }} up={{ kind: 'focus', speed: 0 }}>
                      Nah
                    </HoldButton>
                    <HoldButton disabled={disabled} exec={exec} className={driveBtn}
                      down={{ kind: 'focus', speed: mag }} up={{ kind: 'focus', speed: 0 }}>
                      Fern
                    </HoldButton>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button size="sm" variant="outline" disabled={disabled}
                      onClick={() => void exec({ kind: 'autofocus', on: true })}>
                      AF an
                    </Button>
                    <Button size="sm" variant="outline" disabled={disabled}
                      onClick={() => void exec({ kind: 'autofocus', on: false })}>
                      AF aus
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <SectionHeader>Kamera</SectionHeader>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" disabled={disabled}
                    onClick={() => void exec({ kind: 'power', on: true })}>
                    Power an
                  </Button>
                  <Button size="sm" variant="outline" disabled={disabled}
                    onClick={() => {
                      if (confirm('Kamera in Standby schalten?')) void exec({ kind: 'power', on: false });
                    }}>
                    Standby
                  </Button>
                  {status?.power && (
                    <span className="self-center text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                      {status.power === 'on' ? 'eingeschaltet' : 'im Standby'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Presets */}
          <div className="mt-6 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <SectionHeader>Presets</SectionHeader>
              {canExec && (
                <button
                  type="button"
                  onClick={() => setStoreMode((v) => !v)}
                  className={cn(
                    'h-7 px-3 rounded-[var(--radius-sm)] text-[10px] uppercase tracking-wider font-extrabold transition-colors',
                    storeMode
                      ? 'bg-[var(--destructive)] text-white'
                      : 'bg-[var(--input)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
                  )}
                >
                  {storeMode ? 'Speichern aktiv' : 'Speichern'}
                </button>
              )}
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
              {Array.from({ length: PTZ_PRESET_COUNT }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={disabled}
                  onClick={() => onPreset(n)}
                  className={cn(
                    driveBtn,
                    'h-11 text-sm',
                    storeMode && 'border-[var(--destructive)]/60 text-[var(--destructive)]',
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            {storeMode && (
              <p className="text-[11px] text-[var(--destructive)]">
                Speichern-Modus: ein Klick legt die aktuelle Position auf den Preset.
              </p>
            )}
          </div>

          {canManage && (
            <div className="mt-6 pt-4 border-t border-[var(--border)]/40 flex gap-2">
              {adding ? (
                <PtzForm onSubmit={saveCamera} onCancel={() => setAdding(false)} />
              ) : (
                <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
                  Weitere Kamera
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

const driveBtn = cn(
  'h-12 flex items-center justify-center select-none touch-none',
  'rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]/60',
  'text-base font-extrabold text-[var(--foreground)]',
  'hover:bg-[var(--input)] active:bg-[var(--primary)] active:text-[var(--primary-foreground)]',
  'disabled:opacity-40 disabled:pointer-events-none transition-colors',
);

/**
 * Press-and-hold control: emits `down` on press, `up` (stop) on release. Uses
 * pointer capture so the stop still fires if the finger/mouse leaves the button.
 */
function HoldButton({
  down,
  up,
  exec,
  disabled,
  className,
  children,
}: {
  down: PtzAction;
  up: PtzAction;
  exec: (a: PtzAction) => void | Promise<void>;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const holding = useRef(false);

  const start = (e: React.PointerEvent<HTMLButtonElement>): void => {
    if (disabled || holding.current) return;
    holding.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* capture optional */
    }
    void exec(down);
  };
  const stop = (): void => {
    if (!holding.current) return;
    holding.current = false;
    void exec(up);
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
      className={className}
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: PtzStatusEvent | undefined }) {
  if (!status) return <StatusPill status="info">Idle</StatusPill>;
  if (status.state === 'connected') {
    const label = status.power === 'standby' ? 'Standby' : 'Bereit';
    return <StatusPill status="live">{label}</StatusPill>;
  }
  if (status.state === 'polling') return <StatusPill status="setup">Suche …</StatusPill>;
  return (
    <span title={status.lastError ?? 'Offline'}>
      <StatusPill status="error">Offline</StatusPill>
    </span>
  );
}

function PtzForm({
  initial,
  onSubmit,
  onCancel,
  onDelete,
}: {
  initial?: PtzCameraConfig;
  onSubmit: (cfg: PtzCameraConfig) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? 'AW-UE150');
  const [host, setHost] = useState(initial?.host ?? '');
  const [port, setPort] = useState(String(initial?.port ?? DEFAULT_PTZ_PORT));
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const portNum = Number(port);
        if (!host || !name || !Number.isInteger(portNum) || portNum <= 0) return;
        setBusy(true);
        try {
          await onSubmit({
            id: initial?.id ?? `ptz-${Date.now().toString(36)}`,
            name,
            host,
            port: portNum,
            ...(initial?.model ? { model: initial.model } : {}),
          });
        } finally {
          setBusy(false);
        }
      }}
      className="flex items-end gap-2 flex-wrap"
    >
      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
        Name
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
        Host / IP
        <Input
          value={host}
          onChange={(e) => setHost(e.target.value)}
          placeholder="192.168.10.21"
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
        Port
        <Input
          type="number"
          value={port}
          onChange={(e) => setPort(e.target.value)}
          className="w-24"
          required
        />
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
