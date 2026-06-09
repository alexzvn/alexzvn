import { useState } from 'react';
import { Card } from '@jm/ui';
import { Headline } from '@/components/ui/Headline';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useSession } from '@/store/session';
import { canDo } from '@shared/roles';
import { DeviceTable } from '@/components/setup/DeviceTable';
import { DiscoverPanel } from '@/components/setup/DiscoverPanel';
import { UserManager } from '@/components/setup/UserManager';
import { cn } from '@jm/ui';

type Tab = 'inventory' | 'discovery' | 'users';

export function SetupView() {
  const role = useSession((s) => s.user?.role);
  const isAdmin = role ? canDo(role, 'users:read') : false;
  const [tab, setTab] = useState<Tab>('inventory');

  return (
    <div className="flex flex-col gap-4">
      <div>
        <SectionHeader>Setup</SectionHeader>
        <Headline variant="section" className="mt-2">
          Geräte · Discovery · Benutzer
        </Headline>
      </div>
      <div className="flex gap-2 border-b border-[var(--border)]/40">
        <TabButton active={tab === 'inventory'} onClick={() => setTab('inventory')}>
          Inventar
        </TabButton>
        <TabButton active={tab === 'discovery'} onClick={() => setTab('discovery')}>
          Discovery
        </TabButton>
        {isAdmin && (
          <TabButton active={tab === 'users'} onClick={() => setTab('users')}>
            Benutzer
          </TabButton>
        )}
      </div>
      <Card className="p-6">
        {tab === 'inventory' && <DeviceTable />}
        {tab === 'discovery' && <DiscoverPanel />}
        {tab === 'users' && isAdmin && <UserManager />}
      </Card>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-10 px-4 text-xs uppercase tracking-wider font-extrabold',
        'border-b-2 -mb-px transition-colors',
        active
          ? 'border-[var(--primary)] text-[var(--foreground)]'
          : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
      )}
    >
      {children}
    </button>
  );
}
