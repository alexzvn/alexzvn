import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge, Button, Card, Logo } from '@jm/ui';
import type { JmNdiSource, JmNdiStatus } from '@shared/types';
import { CaptureSession, type CaptureStats } from './core/capture';
import { SourcePicker } from './components/SourcePicker';
import { StatusBar } from './components/StatusBar';
import { Preview } from './components/Preview';

const IDLE_STATUS: JmNdiStatus = { sendState: 'idle', audioEnabled: false };
const TARGET_FPS = 30;

export function App() {
  const [sources, setSources] = useState<JmNdiSource[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<JmNdiStatus>(IDLE_STATUS);
  const [stats, setStats] = useState<CaptureStats | null>(null);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const sessionRef = useRef<CaptureSession | null>(null);

  const refreshSources = useCallback(async () => {
    const list = await window.jmndi.listSources();
    setSources(list);
    setSelectedId((prev) => prev ?? list[0]?.id ?? null);
  }, []);

  useEffect(() => {
    void refreshSources();
    void window.jmndi.getStatus().then(setStatus);
    const off = window.jmndi.onStatus(setStatus);
    return () => {
      off();
      sessionRef.current?.stop();
    };
  }, [refreshSources]);

  const drawFrame = useCallback((frame: VideoFrame) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (canvas.width !== frame.displayWidth || canvas.height !== frame.displayHeight) {
      canvas.width = frame.displayWidth;
      canvas.height = frame.displayHeight;
    }
    if (!ctxRef.current) ctxRef.current = canvas.getContext('2d');
    ctxRef.current?.drawImage(frame, 0, 0);
  }, []);

  const stop = useCallback(async () => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setActive(false);
    setStats(null);
    await window.jmndi.stop();
  }, []);

  const start = useCallback(async () => {
    if (!selectedId) return;
    setBusy(true);
    try {
      // Quelle im Main vormerken, dann Capture starten (löst getDisplayMedia aus).
      await window.jmndi.start({
        sourceId: selectedId,
        targetFps: TARGET_FPS,
        audio: false,
        pixelFormat: 'bgra',
      });
      const session = new CaptureSession(
        {
          onFrame: drawFrame,
          onStats: setStats,
          onError: (e) => {
            setStatus((s) => ({ ...s, sendState: 'error', error: e.message }));
            void stop();
          },
          onEnded: () => setActive(false),
        },
        { targetFps: TARGET_FPS },
      );
      sessionRef.current = session;
      await session.start();
      setActive(true);
    } catch (e) {
      setStatus((s) => ({ ...s, sendState: 'error', error: e instanceof Error ? e.message : String(e) }));
      await stop();
    } finally {
      setBusy(false);
    }
  }, [selectedId, drawFrame, stop]);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)] text-[var(--foreground)]">
      <header className="flex items-center gap-3 border-b border-[var(--border)] px-6 py-4">
        <Logo size={26} />
        <div className="flex flex-col">
          <span className="text-sm font-extrabold uppercase tracking-[0.14em]">
            JM NDI Screen Capture
          </span>
          <span className="text-xs text-[var(--muted-foreground)]">
            Bildschirm &amp; Fenster als NDI-Quelle ins Studio-LAN
          </span>
        </div>
        <Badge tone="warning" className="ml-auto">
          Vorschau v0.1.0
        </Badge>
      </header>

      <main className="grid flex-1 gap-4 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Vorschau + Status */}
        <section className="flex flex-col gap-3">
          <Preview canvasRef={canvasRef} active={active} />
          <StatusBar status={status} stats={stats} />
        </section>

        {/* Quellenauswahl + Steuerung */}
        <aside className="flex flex-col gap-3">
          <Card className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                Quelle
              </h2>
              <Button size="sm" variant="ghost" onClick={() => void refreshSources()} disabled={active}>
                Aktualisieren
              </Button>
            </div>
            <SourcePicker
              sources={sources}
              selectedId={selectedId}
              onSelect={setSelectedId}
              disabled={active}
            />
          </Card>

          <Button
            size="lg"
            variant={active ? 'destructive' : 'primary'}
            disabled={busy || (!active && !selectedId)}
            onClick={() => void (active ? stop() : start())}
          >
            {active ? 'Stoppen' : 'Vorschau starten'}
          </Button>
        </aside>
      </main>

      <footer className="px-6 py-4 text-center text-[10px] text-[var(--muted-foreground)]">
        NDI® is a registered trademark of Vizrt NDI AB.
      </footer>
    </div>
  );
}
