import { Button, cn, Logo } from '@jm/ui';
import type { PresenterMode, StageConfig } from '@shared/types';
import { useStage } from '@/store/stage';
import { useTick } from '@/lib/format';
import { StageScreen } from '@/components/StageScreen';

export function OperatorView() {
  const state = useStage((s) => s.state);
  const setConfig = useStage((s) => s.setConfig);
  const displays = useStage((s) => s.displays);
  const outputOpen = useStage((s) => s.outputOpen);
  const openOutput = useStage((s) => s.openOutput);
  const closeOutput = useStage((s) => s.closeOutput);
  const refreshDisplays = useStage((s) => s.refreshDisplays);
  const now = useTick();

  if (!state) return <div className="h-screen grid place-items-center text-[var(--muted-foreground)]">Lädt…</div>;
  const c = state.config;

  return (
    <div className="h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)]">
      <header className="h-14 shrink-0 flex items-center gap-3 px-6 border-b border-[var(--border)]/60">
        <Logo size={24} />
        <span className="text-sm font-extrabold tracking-[0.06em]">JM STAGE DISPLAY</span>
        <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
          Bühnen-/Crew-Schirm
        </span>
      </header>

      <div className="flex-1 overflow-auto">
        <div className="max-w-[900px] mx-auto px-6 py-6 space-y-6">
          {/* Live-Vorschau */}
          <div>
            <SectionHeader>Vorschau</SectionHeader>
            <div className="aspect-video w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)]">
              <StageScreen state={state} now={now} />
            </div>
          </div>

          {/* Ausgabe */}
          <Section title="Ausgabe (Bühnenschirm)">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={c.outputDisplayId ?? ''}
                onChange={(e) => setConfig({ outputDisplayId: e.target.value ? Number(e.target.value) : null })}
                onFocus={() => void refreshDisplays()}
                className="h-9 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm font-semibold"
              >
                <option value="">Primärer Bildschirm</option>
                {displays.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                    {d.primary ? ' · primär' : ''} ({d.width}×{d.height})
                  </option>
                ))}
              </select>
              {outputOpen ? (
                <>
                  <Button size="sm" variant="primary" onClick={() => void openOutput(c.outputDisplayId ?? undefined)}>
                    Auf diesen Bildschirm
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void closeOutput()}>
                    Ausgabe schließen
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="primary" onClick={() => void openOutput(c.outputDisplayId ?? undefined)}>
                  Vollbild-Ausgabe öffnen
                </Button>
              )}
            </div>
          </Section>

          {/* Quellen */}
          <Section title="Quellen">
            <div className="space-y-3">
              <SourceRow
                label="JM Timer"
                hint="Countdown · Programmpunkt · Nachricht (Port 7777)"
                enabled={c.timer.enabled}
                host={c.timer.host}
                port={c.timer.port}
                connected={state.timer.connected}
                onToggle={(enabled) => setConfig({ timer: { enabled } })}
                onHost={(host) => setConfig({ timer: { host } })}
                onPort={(port) => setConfig({ timer: { port } })}
              />
              <SourceRow
                label="JM Switcher"
                hint="Program/Preview · REC/Stream (Companion-Port)"
                enabled={c.switcher.enabled}
                host={c.switcher.host}
                port={c.switcher.port}
                connected={state.switcher.connected}
                onToggle={(enabled) => setConfig({ switcher: { enabled } })}
                onHost={(host) => setConfig({ switcher: { host } })}
                onPort={(port) => setConfig({ switcher: { port } })}
              />
              <SourceRow
                label="JM Presenter"
                hint="Referentenansicht: Folie · Notizen · Nächste (Fernsteuerung im Presenter aktivieren, Port 7330)"
                enabled={c.presenter.enabled}
                host={c.presenter.host}
                port={c.presenter.port}
                connected={state.presenter.connected}
                pin={c.presenter.pin}
                pinHint="PIN nur falls die Presenter-Fernsteuerung mit PIN läuft — sonst leer lassen"
                onToggle={(enabled) => setConfig({ presenter: { enabled } })}
                onHost={(host) => setConfig({ presenter: { host } })}
                onPort={(port) => setConfig({ presenter: { port } })}
                onPin={(pin) => setConfig({ presenter: { pin } })}
                footer={
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[var(--muted-foreground)]">Anzeige</span>
                    <div className="inline-flex rounded-[var(--radius)] border border-[var(--border)] overflow-hidden">
                      {(
                        [
                          ['ref', 'Referenzansicht'],
                          ['main', 'Hauptansicht'],
                        ] as [PresenterMode, string][]
                      ).map(([m, label]) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setConfig({ presenter: { mode: m } })}
                          className={cn(
                            'px-3 h-8 text-xs font-semibold transition-colors',
                            c.presenter.mode === m
                              ? 'bg-[var(--primary)] text-[var(--brand-dark)]'
                              : 'hover:bg-[var(--highlight)]',
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <span className="text-[11px] text-[var(--muted-foreground)]">
                      Folienbild erscheint, sobald eine Präsentation läuft
                    </span>
                  </div>
                }
              />
            </div>
          </Section>

          {/* Anzeige-Elemente */}
          <Section title="Anzeige-Elemente">
            <div className="flex flex-wrap gap-4">
              {(['clock', 'timer', 'switcher', 'presenter', 'message'] as (keyof StageConfig['widgets'])[]).map((key) => (
                <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={c.widgets[key]}
                    onChange={(e) => setConfig({ widgets: { [key]: e.target.checked } })}
                  />
                  {WIDGET_LABEL[key]}
                </label>
              ))}
            </div>
          </Section>

          {/* Ad-hoc-Nachricht */}
          <Section title="Nachricht (Ad-hoc, hat Vorrang vor Timer-Nachricht)">
            <input
              value={c.message}
              onChange={(e) => setConfig({ message: e.target.value })}
              placeholder={'z. B. „Bitte Plätze einnehmen“ — leer = Timer-Nachricht'}
              className="h-10 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm"
            />
          </Section>
        </div>
      </div>
    </div>
  );
}

const WIDGET_LABEL: Record<keyof StageConfig['widgets'], string> = {
  clock: 'Uhr',
  timer: 'Timer/Countdown',
  switcher: 'Switcher-Status',
  presenter: 'Presenter (REF)',
  message: 'Nachricht',
};

function SourceRow({
  label,
  hint,
  enabled,
  host,
  port,
  connected,
  pin,
  pinHint,
  footer,
  onToggle,
  onHost,
  onPort,
  onPin,
}: {
  label: string;
  hint: string;
  enabled: boolean;
  host: string;
  port: number;
  connected: boolean;
  /** Optional PIN field (only rendered when `onPin` is provided). */
  pin?: string;
  pinHint?: string;
  /** Optional extra controls rendered at the bottom of the card when enabled. */
  footer?: React.ReactNode;
  onToggle: (v: boolean) => void;
  onHost: (v: string) => void;
  onPort: (v: number) => void;
  onPin?: (v: string) => void;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] p-3.5">
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
          <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} />
          {label}
        </label>
        {enabled && (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] font-extrabold border',
              connected
                ? 'border-[var(--primary)]/40 text-[var(--primary)]'
                : 'border-[var(--destructive)]/50 text-[var(--destructive)]',
            )}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: connected ? 'var(--primary)' : 'var(--destructive)' }}
            />
            {connected ? 'verbunden' : 'getrennt'}
          </span>
        )}
        <span className="ml-auto text-[11px] text-[var(--muted-foreground)] hidden md:block">{hint}</span>
      </div>
      {enabled && (
        <div className="mt-3 flex items-center gap-2">
          <input
            value={host}
            onChange={(e) => onHost(e.target.value)}
            placeholder="Host/IP"
            className="h-9 flex-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm"
          />
          <input
            type="number"
            value={String(port)}
            onChange={(e) => onPort(Math.max(1, Number(e.target.value) || port))}
            className="h-9 w-24 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm tabular-nums"
          />
          {onPin && (
            <input
              value={pin ?? ''}
              onChange={(e) => onPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
              inputMode="numeric"
              placeholder="PIN"
              title={pinHint}
              className="h-9 w-20 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm tabular-nums"
            />
          )}
        </div>
      )}
      {enabled && onPin && pinHint && (
        <div className="mt-1.5 text-[11px] text-[var(--muted-foreground)]">{pinHint}</div>
      )}
      {enabled && footer && <div className="mt-3">{footer}</div>}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] uppercase tracking-[0.14em] font-extrabold text-[var(--muted-foreground)] mb-2">
      {children}
    </h3>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <SectionHeader>{title}</SectionHeader>
      {children}
    </section>
  );
}
