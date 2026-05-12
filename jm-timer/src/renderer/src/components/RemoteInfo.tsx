import { useEffect, useState } from 'react';
import { useStore } from '@/store/timer';
import { Card } from './ui/Card';
import { SectionHeader } from './ui/SectionHeader';
import { StatusPill } from './ui/StatusPill';
import { Button } from './ui/Button';
import { cn } from '@/lib/cn';

export function RemoteInfo() {
  const connected = useStore((s) => s.connected);
  const [urls, setUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!window.jm?.remote) {
        setUrls([]);
        setLoading(false);
        return;
      }
      try {
        const list = await window.jm.remote.getUrls();
        if (!cancelled) {
          setUrls(list);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const id = window.setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      // ignore (some browsers in non-secure contexts)
    }
  }

  return (
    <section className="flex flex-col h-full px-2 max-w-[960px] gap-6">
      <div className="flex items-center justify-between">
        <SectionHeader>Remote · LAN-Browser</SectionHeader>
        <StatusPill status={connected ? 'live' : 'error'}>
          {connected ? 'Sync · Verbunden' : 'Sync · Offline'}
        </StatusPill>
      </div>

      <Card>
        <div className="p-6 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold">Speaker-View im Browser öffnen</h3>
            <p className="text-sm text-[var(--muted-foreground)]">
              Jedes Gerät im gleichen WLAN/LAN kann eine der folgenden URLs öffnen
              und sieht den Speaker-View live — z. B. ein iPad als Backstage-Display,
              ein zweiter Bildschirm im Regieraum oder ein Smartphone als Side-Monitor.
              <br />
              <span className="text-[var(--muted-foreground)]">
                Read-Only · Anzeige spiegelt 1:1 die Speaker-Fenster-Ansicht.
              </span>
            </p>
          </div>

          {loading ? (
            <div className="text-sm text-[var(--muted-foreground)]">
              Netzwerk-Adressen werden ermittelt…
            </div>
          ) : urls.length === 0 ? (
            <div className="text-sm text-[var(--destructive)]">
              Keine LAN-Adresse gefunden. Vermutlich nur Loopback verfügbar — prüfe
              WLAN/Netzwerk-Verbindung.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {urls.map((url) => (
                <div
                  key={url}
                  className={cn(
                    'flex items-center justify-between gap-3 px-4 py-3 rounded-[var(--radius-md)]',
                    'border border-[var(--border)]/40 bg-[var(--card)]/40',
                  )}
                >
                  <code className="text-sm font-mono text-[var(--foreground)] break-all">
                    {url}
                  </code>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      uppercase={false}
                      onClick={() => copy(url)}
                    >
                      {copied === url ? 'Kopiert' : 'Kopieren'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card variant="nested">
        <div className="p-5 flex flex-col gap-3">
          <SectionHeader>Hinweise</SectionHeader>
          <ul className="flex flex-col gap-2 text-sm text-[var(--muted-foreground)]">
            <li>
              <span className="text-[var(--slash)] mr-2">/</span>
              Klingt eine Adresse falsch (z. B. VPN-IP), nutze die mit dem
              passenden Subnet — meistens <code>192.168.x.x</code>.
            </li>
            <li>
              <span className="text-[var(--slash)] mr-2">/</span>
              In Production lädt der Browser HTML+JS direkt vom App-Server (Port
              7777). Im Dev-Modus läuft die UI über den Vite-Devserver (Port
              5173); die Socket-Verbindung geht trotzdem auf Port 7777.
            </li>
            <li>
              <span className="text-[var(--slash)] mr-2">/</span>
              Firewall: Port <strong>7777</strong> (und im Dev zusätzlich{' '}
              <strong>5173</strong>) muss erreichbar sein.
            </li>
            <li>
              <span className="text-[var(--slash)] mr-2">/</span>
              Aktuell keine Authentifizierung — Remote-Clients im gleichen Netz
              können sich frei verbinden. Für öffentliche Netze unbedingt
              vorsichtig sein.
            </li>
          </ul>
        </div>
      </Card>
    </section>
  );
}
