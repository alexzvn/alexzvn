import type { ReactNode } from 'react';
import { Topbar } from './Topbar';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="h-full flex flex-col">
      <Topbar />
      <main className="flex-1 overflow-auto">
        <div className="max-w-[1400px] mx-auto px-7 py-6 h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
