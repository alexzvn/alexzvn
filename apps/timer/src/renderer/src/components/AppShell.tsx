import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MessageBar } from './MessageBar';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="h-full flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <MessageBar />
        <main className="flex-1 overflow-auto">
          <div className="max-w-[1400px] mx-auto px-7 py-6 h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
