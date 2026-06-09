import { useState } from 'react';
import { cn } from '@jm/ui';
import { Topbar, type SwitcherTab } from '@/components/Topbar';
import { SwitcherView } from '@/views/SwitcherView';
import { SettingsView } from '@/views/SettingsView';

export function App() {
  const [tab, setTab] = useState<SwitcherTab>('switcher');

  return (
    <div className="h-full flex flex-col">
      <Topbar tab={tab} onTab={setTab} />
      <main className="flex-1 overflow-hidden relative">
        {/* Mischer bleibt immer gemountet (Engine/Canvas/Recorder laufen weiter) — */}
        {/* beim Settings-Tab nur ausblenden, damit ein laufender Stream nicht abbricht. */}
        <div className={cn('h-full', tab !== 'switcher' && 'hidden')}>
          <SwitcherView onOpenSettings={() => setTab('settings')} />
        </div>
        {tab === 'settings' && <SettingsView />}
      </main>
    </div>
  );
}
