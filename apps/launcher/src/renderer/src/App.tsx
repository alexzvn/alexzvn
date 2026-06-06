import { useEffect, useMemo, useState } from 'react';
import { Button } from '@jm/ui';
import type { ToolCategory } from '@shared/types';
import { Header } from '@/components/Header';
import { CategoryChips, type CategoryFilter } from '@/components/CategoryChips';
import { ToolCard } from '@/components/ToolCard';
import { SettingsModal } from '@/components/SettingsModal';
import { useTools } from '@/store/tools';

const CATEGORY_ORDER: ToolCategory[] = ['Ingest', 'Grafik', 'Studio', 'Utilities'];

export function App() {
  const tools = useTools((s) => s.tools);
  const states = useTools((s) => s.states);
  const loading = useTools((s) => s.loading);
  const notice = useTools((s) => s.notice);
  const load = useTools((s) => s.load);
  const setNotice = useTools((s) => s.setNotice);

  const [filter, setFilter] = useState<CategoryFilter>('Alle');

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice, setNotice]);

  const categories = useMemo<CategoryFilter[]>(() => {
    const present = CATEGORY_ORDER.filter((c) => tools.some((t) => t.category === c));
    return ['Alle', ...present];
  }, [tools]);

  const visible = useMemo(
    () => (filter === 'Alle' ? tools : tools.filter((t) => t.category === filter)),
    [tools, filter],
  );

  const installedCount = Object.values(states).filter((s) => s.status === 'installed').length;

  return (
    <div className="h-full flex flex-col">
      <Header />

      <LauncherUpdateBanner />

      <main className="flex-1 overflow-auto">
        <div className="max-w-[1200px] mx-auto px-7 py-7 flex flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">Werkzeugkasten</h1>
              <p className="text-sm text-[var(--muted-foreground)] mt-1">
                {loading
                  ? 'Lade Tools…'
                  : `${tools.length} Tools · ${installedCount} installiert`}
              </p>
            </div>
            <CategoryChips categories={categories} active={filter} onChange={setFilter} />
          </div>

          {!loading && visible.length === 0 && (
            <p className="text-sm text-[var(--muted-foreground)]">
              Keine Tools in dieser Kategorie.
            </p>
          )}

          <div className="grid gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((tool) => (
              <ToolCard key={tool.id} tool={tool} state={states[tool.id]} />
            ))}
          </div>
        </div>
      </main>

      {notice && (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 flex justify-center px-6">
          <div
            className="pointer-events-auto jm-fade-in rounded-[var(--radius-lg)] border border-[var(--primary)]/40
                       bg-[var(--card)] px-4 py-2.5 text-sm font-semibold shadow-lg max-w-xl text-center"
          >
            {notice}
          </div>
        </div>
      )}

      <SettingsModal />
    </div>
  );
}

function LauncherUpdateBanner() {
  const upd = useTools((s) => s.launcherUpdate);
  const busy = useTools((s) => s.busy['launcher'] ?? false);
  const progress = useTools((s) => s.progress['launcher']);
  const updateLauncher = useTools((s) => s.updateLauncher);

  if (!upd) return null;

  const downloading = busy && progress?.phase === 'download';
  return (
    <div
      className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-b border-[var(--primary)]/40
                 bg-[var(--highlight)] px-6 py-2.5 text-sm"
    >
      <span className="font-semibold">
        Neue Launcher-Version <strong>{upd.latest}</strong> verfügbar
        <span className="text-[var(--muted-foreground)]"> (installiert {upd.current})</span>
      </span>
      <Button size="sm" variant="primary" disabled={busy} onClick={() => updateLauncher()}>
        {downloading
          ? `Lädt… ${progress?.pct ?? 0}%`
          : busy
            ? 'Installer startet…'
            : 'Aktualisieren'}
      </Button>
    </div>
  );
}
