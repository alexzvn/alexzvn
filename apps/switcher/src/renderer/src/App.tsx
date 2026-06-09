import { Topbar } from '@/components/Topbar';
import { SwitcherView } from '@/views/SwitcherView';

export function App() {
  return (
    <div className="h-full flex flex-col">
      <Topbar />
      <main className="flex-1 overflow-hidden">
        <SwitcherView />
      </main>
    </div>
  );
}
