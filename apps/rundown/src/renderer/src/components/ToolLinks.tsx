import type { ToolLink } from '@shared/types';

/** Status-Strip: welche Tools der Conductor im LAN gefunden/verbunden hat. */
export function ToolLinks({ links }: { links: ToolLink[] }) {
  if (!links.length) {
    return (
      <div className="px-4 py-1.5 text-xs text-neutral-500">
        Noch keine Tools im LAN gefunden — Suite-Tools im selben Netz starten (mDNS).
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-2 px-4 py-1.5">
      {links.map((l) => (
        <span
          key={l.role}
          title={`${l.host}:${l.port}`}
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs ${
            l.connected ? 'bg-green-500/15 text-green-300' : 'bg-neutral-700/40 text-neutral-400'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${l.connected ? 'bg-green-400' : 'bg-neutral-500'}`} />
          {l.label}
        </span>
      ))}
    </div>
  );
}
