import { useState } from 'react';
import { Button, Card, cn } from '@jm/ui';
import { createShow, type Show, type ShowToolRef } from '@jm/show';
import { useTools } from '@/store/tools';

interface Entry {
  included: boolean;
  document: string;
  /** Optionaler Host, auf dem das Tool läuft (→ network.host). Leer = dieser PC. */
  host: string;
}

interface TtRow {
  label: string;
  /** Dauer in Minuten als Eingabe-String (z. B. "5" oder "2.5"). */
  minutes: string;
}

const EMPTY_ENTRY: Entry = { included: false, document: '', host: '' };

const inputCls = cn(
  'rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)]',
  'text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]',
  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]',
);

export function ShowEditorModal() {
  const open = useTools((s) => s.showEditorOpen);
  const tools = useTools((s) => s.tools);
  const close = useTools((s) => s.closeShowEditor);
  const saveShow = useTools((s) => s.saveShow);

  const [name, setName] = useState('');
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [timetable, setTimetable] = useState<TtRow[]>([]);
  const [battleA, setBattleA] = useState('');
  const [battleB, setBattleB] = useState('');
  const [battleRounds, setBattleRounds] = useState('');
  const [qaSpeak, setQaSpeak] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const sorted = [...tools].sort((a, b) => a.name.localeCompare(b.name));
  const selectedCount = Object.values(entries).filter((e) => e.included).length;
  const canSave = selectedCount > 0 && !busy;

  const setEntry = (id: string, patch: Partial<Entry>): void =>
    setEntries((prev) => ({
      ...prev,
      [id]: { ...EMPTY_ENTRY, ...prev[id], ...patch },
    }));

  const pickDoc = async (id: string): Promise<void> => {
    const path = await window.jmps.pickShowDocument();
    if (path) setEntry(id, { included: true, document: path });
  };

  const addTtRow = (): void => setTimetable((rows) => [...rows, { label: '', minutes: '' }]);
  const setTtRow = (i: number, patch: Partial<TtRow>): void =>
    setTimetable((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const removeTtRow = (i: number): void =>
    setTimetable((rows) => rows.filter((_, idx) => idx !== i));

  const buildRef = (id: string): ShowToolRef => {
    const e = entries[id];
    const ref: ShowToolRef = { appId: id };
    const doc = e?.document.trim();
    if (doc) ref.document = doc;
    const host = e?.host.trim();
    if (host) ref.network = { host };
    if (id === 'jm-timer') {
      const items = timetable
        .filter((r) => r.label.trim() || r.minutes.trim())
        .map((r) => ({
          label: r.label.trim(),
          durationMs: Math.max(0, Math.round((parseFloat(r.minutes) || 0) * 60000)),
        }));
      if (items.length) ref.settings = { timetable: items };
    }
    if (id === 'jm-battle') {
      const s: Record<string, unknown> = {};
      if (battleA.trim()) s.nameA = battleA.trim();
      if (battleB.trim()) s.nameB = battleB.trim();
      const r = parseInt(battleRounds, 10);
      if (Number.isFinite(r) && r > 0) s.rounds = r;
      if (Object.keys(s).length) ref.settings = s;
    }
    if (id === 'jm-qa') {
      const sec = parseInt(qaSpeak, 10);
      if (Number.isFinite(sec) && sec > 0) ref.settings = { speakSeconds: sec };
    }
    return ref;
  };

  const onSave = async (): Promise<void> => {
    const show: Show = {
      ...createShow(name.trim() || 'Unbenannte Show'),
      tools: sorted.filter((t) => entries[t.id]?.included).map((t) => buildRef(t.id)),
    };
    setBusy(true);
    try {
      const ok = await saveShow(show);
      if (ok) {
        setName('');
        setEntries({});
        setTimetable([]);
        setBattleA('');
        setBattleB('');
        setBattleRounds('');
        setQaSpeak('');
        close();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm px-6">
      <Card className="w-full max-w-lg p-6 jm-fade-in">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight">Show anlegen</h2>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            Tools für die Produktion auswählen und als .jmshow speichern. Beim Öffnen startet
            der Launcher alle gewählten Tools und gibt jedem seinen Teil mit.
          </p>
        </div>

        <label className="mt-5 flex flex-col gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.12em] font-extrabold text-[var(--muted-foreground)]">
            Name der Show
          </span>
          <input
            value={name}
            placeholder="z. B. Gottesdienst 10 Uhr"
            onChange={(e) => setName(e.target.value)}
            className={cn(inputCls, 'h-10 px-3 text-sm')}
          />
        </label>

        <div className="mt-5 max-h-[52vh] overflow-auto flex flex-col gap-1.5">
          {sorted.map((t) => {
            const entry = entries[t.id];
            const included = entry?.included ?? false;
            return (
              <div
                key={t.id}
                className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2"
              >
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={included}
                    onChange={(e) => setEntry(t.id, { included: e.target.checked })}
                    className="size-4 accent-[var(--primary)]"
                  />
                  <span className="text-sm font-semibold">{t.name}</span>
                  <span className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
                    {t.category}
                  </span>
                </label>

                {included && (
                  <div className="mt-2 flex flex-col gap-2 pl-6">
                    <div className="flex items-center gap-2">
                      <input
                        value={entry?.document ?? ''}
                        placeholder="Optional: Dokument (z. B. .jmpres)"
                        onChange={(e) => setEntry(t.id, { document: e.target.value })}
                        className={cn(inputCls, 'h-8 flex-1 px-2.5 text-xs')}
                      />
                      <Button size="sm" variant="ghost" onClick={() => void pickDoc(t.id)}>
                        …
                      </Button>
                    </div>
                    <input
                      value={entry?.host ?? ''}
                      placeholder="Optional: Host / IP (Standard: dieser PC)"
                      onChange={(e) => setEntry(t.id, { host: e.target.value })}
                      className={cn(inputCls, 'h-8 px-2.5 text-xs')}
                    />

                    {t.id === 'jm-timer' && (
                      <div className="mt-1 rounded-[var(--radius)] border border-[var(--border)]/60 bg-[var(--input)]/40 p-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase tracking-[0.12em] font-extrabold text-[var(--muted-foreground)]">
                            Ablaufplan
                          </span>
                          <Button size="sm" variant="ghost" onClick={addTtRow}>
                            + Eintrag
                          </Button>
                        </div>
                        {timetable.length === 0 ? (
                          <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                            Optional — Punkte mit Dauer (Minuten) für den Timer.
                          </p>
                        ) : (
                          <div className="mt-2 flex flex-col gap-1.5">
                            {timetable.map((r, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <input
                                  value={r.label}
                                  placeholder="Punkt (z. B. Begrüßung)"
                                  onChange={(e) => setTtRow(i, { label: e.target.value })}
                                  className={cn(inputCls, 'h-8 flex-1 px-2.5 text-xs')}
                                />
                                <input
                                  value={r.minutes}
                                  inputMode="decimal"
                                  placeholder="Min"
                                  onChange={(e) => setTtRow(i, { minutes: e.target.value })}
                                  className={cn(inputCls, 'h-8 w-16 px-2.5 text-xs tabular-nums')}
                                />
                                <Button size="sm" variant="ghost" onClick={() => removeTtRow(i)}>
                                  ✕
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {t.id === 'jm-battle' && (
                      <div className="mt-1 grid grid-cols-2 gap-2">
                        <input
                          value={battleA}
                          placeholder="Kontrahent A"
                          onChange={(e) => setBattleA(e.target.value)}
                          className={cn(inputCls, 'h-8 px-2.5 text-xs')}
                        />
                        <input
                          value={battleB}
                          placeholder="Kontrahent B"
                          onChange={(e) => setBattleB(e.target.value)}
                          className={cn(inputCls, 'h-8 px-2.5 text-xs')}
                        />
                        <input
                          value={battleRounds}
                          inputMode="numeric"
                          placeholder="Runden (z. B. 3)"
                          onChange={(e) => setBattleRounds(e.target.value)}
                          className={cn(inputCls, 'h-8 px-2.5 text-xs col-span-2 tabular-nums')}
                        />
                      </div>
                    )}

                    {t.id === 'jm-qa' && (
                      <input
                        value={qaSpeak}
                        inputMode="numeric"
                        placeholder="Redezeit je Wortmeldung (Sekunden)"
                        onChange={(e) => setQaSpeak(e.target.value)}
                        className={cn(inputCls, 'h-8 px-2.5 text-xs tabular-nums')}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <span className="text-xs text-[var(--muted-foreground)]">
            {selectedCount} Tool(s) gewählt
          </span>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={close} disabled={busy}>
              Abbrechen
            </Button>
            <Button variant="primary" disabled={!canSave} onClick={() => void onSave()}>
              {busy ? 'Speichere…' : 'Speichern'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
