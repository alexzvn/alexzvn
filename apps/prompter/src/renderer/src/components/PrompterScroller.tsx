import { useEffect, useMemo, useRef } from 'react';
import type { PrompterState } from '@shared/types';
import { positionEm } from '@shared/types';
import { parseScript } from '@/lib/markers';

interface Props {
  state: PrompterState;
  /** Wird einmalig pro Lauf gemeldet, wenn das Ende erreicht ist (Auto-Stopp). */
  onEnd?: () => void;
  /** Marker-Positionen in em (für „voriger/nächster Abschnitt"). */
  onMarkers?: (positionsEm: number[]) => void;
}

/**
 * Geteilter Scroller — gerendert im Vollbild-Ausgabefenster UND in der
 * Operator-Vorschau. Die Position wird in em geführt (siehe shared/types):
 * `container-type: size` + `font-size: Ncqh` skalieren die Schrift relativ zur
 * jeweiligen Containerhöhe, sodass beide Ansichten proportional identisch sind.
 */
export function PrompterScroller({ state, onEnd, onMarkers }: Props): React.JSX.Element {
  const { config } = state;
  const lines = useMemo(() => parseScript(config.script), [config.script]);

  const containerRef = useRef<HTMLDivElement>(null);
  const moverRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Letzter State für die rAF-Schleife (ohne Re-Render pro Frame).
  const stateRef = useRef(state);
  stateRef.current = state;

  // Gemessene Größen: 1em in px + Inhaltshöhe in em.
  const emPxRef = useRef(16);
  const contentEmRef = useRef(0);
  const endedRef = useRef(false);

  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  const onMarkersRef = useRef(onMarkers);
  onMarkersRef.current = onMarkers;

  // Größen vermessen + Marker-Positionen melden (bei Layout-/Inhaltsänderung).
  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const measure = (): void => {
      const emPx = parseFloat(getComputedStyle(content).fontSize) || 16;
      emPxRef.current = emPx;
      contentEmRef.current = content.scrollHeight / emPx;
      if (onMarkersRef.current) {
        // offsetTop ist relativ zum positionierten Container (enthält den
        // Vorlauf); relativ zum Textanfang rechnen → Position in em, bei der die
        // Marke die Lese-Linie erreicht.
        const base = content.offsetTop;
        const markers = Array.from(
          content.querySelectorAll<HTMLElement>('[data-marker]'),
        ).map((el) => (el.offsetTop - base) / emPx);
        onMarkersRef.current(markers);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(content);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [config.script, config.fontScale, config.lineHeight, config.marginXPct, config.bold]);

  // rAF: interpoliert die Position und setzt nur die transform-Eigenschaft.
  useEffect(() => {
    let raf = 0;
    let last = -1;
    const tick = (): void => {
      const s = stateRef.current;
      const maxEm = Math.max(0, contentEmRef.current);
      let pos = positionEm(s.transport);
      // Nur clampen/beenden, wenn die Inhaltshöhe schon gemessen ist. Sonst (maxEm
      // === 0 vor der ersten Messung oder bei einem transienten Resize-Messwert)
      // würde `pos >= 0` sofort das Ende auslösen → Auto-Stopp „an zufälliger
      // Stelle" (Issue #29).
      if (maxEm > 0 && pos >= maxEm) {
        if (s.transport.playing && !endedRef.current) {
          endedRef.current = true;
          onEndRef.current?.();
        }
        pos = maxEm;
      } else {
        endedRef.current = false;
      }
      if (pos !== last) {
        last = pos;
        if (moverRef.current) moverRef.current.style.transform = `translateY(${-pos}em)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const mirror = `${config.mirrorH ? 'scaleX(-1)' : ''} ${config.mirrorV ? 'scaleY(-1)' : ''}`.trim();

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden"
      style={{
        containerType: 'size',
        background: config.colors.background,
        color: config.colors.text,
        transform: mirror || undefined,
      }}
    >
      {config.readingLine && (
        <div
          className="pointer-events-none absolute left-0 right-0 z-10 flex items-center"
          style={{ top: `${config.readingLinePct}cqh` }}
        >
          <div
            style={{
              width: 0,
              height: 0,
              borderTop: `1.2cqh solid transparent`,
              borderBottom: `1.2cqh solid transparent`,
              borderLeft: `2cqh solid ${config.colors.accent}`,
            }}
          />
          <div className="flex-1" style={{ height: '0.4cqh', background: config.colors.accent, opacity: 0.55 }} />
          <div
            style={{
              width: 0,
              height: 0,
              borderTop: `1.2cqh solid transparent`,
              borderBottom: `1.2cqh solid transparent`,
              borderRight: `2cqh solid ${config.colors.accent}`,
            }}
          />
        </div>
      )}

      <div ref={moverRef} style={{ willChange: 'transform' }}>
        {/* Vorlauf: erste Zeile startet auf Höhe der Lese-Linie. */}
        <div style={{ height: `${config.readingLinePct}cqh` }} />
        <div
          ref={contentRef}
          style={{
            fontSize: `${config.fontScale}cqh`,
            lineHeight: config.lineHeight,
            fontWeight: config.bold ? 800 : 500,
            paddingLeft: `${config.marginXPct}%`,
            paddingRight: `${config.marginXPct}%`,
            letterSpacing: '0.005em',
          }}
        >
          {lines.map((ln, i) =>
            ln.blank ? (
              <div key={i} style={{ height: '0.6em' }} />
            ) : (
              <div
                key={i}
                {...(ln.marker ? { 'data-marker': '' } : {})}
                style={
                  ln.marker
                    ? { color: config.colors.accent, fontWeight: 900, marginTop: '0.35em' }
                    : undefined
                }
              >
                {ln.text || ' '}
              </div>
            ),
          )}
        </div>
        {/* Nachlauf: letzte Zeile kann bis zur Lese-Linie hochlaufen. */}
        <div style={{ height: `${100 - config.readingLinePct}cqh` }} />
      </div>
    </div>
  );
}
