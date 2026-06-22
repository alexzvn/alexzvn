import { useEffect } from 'react';
import { projectDurationUs } from '@shared/project';
import { useProject } from '@/store/project';
import { engine } from '@/audio/engine';

/**
 * Verbindet den `playing`-Status mit der Web-Audio-Engine: startet/stoppt die
 * Wiedergabe und treibt den Playhead per RAF aus `ctx.currentTime` (sample-genau).
 * Einmal in App montiert.
 */
export function useTransport(): void {
  const playing = useProject((s) => s.playing);

  useEffect(() => {
    let raf = 0;
    if (playing) {
      const st = useProject.getState();
      void engine.play(st.present, st.playheadUs);
      const tick = (): void => {
        const pos = engine.positionUs();
        const dur = projectDurationUs(useProject.getState().present);
        if (dur > 0 && pos >= dur) {
          useProject.getState().setPlayhead(dur);
          useProject.getState().setPlaying(false);
          return;
        }
        useProject.setState({ playheadUs: pos });
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    } else {
      engine.stop();
    }
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [playing]);
}

/**
 * Hält den Live-Mix (Fader/Pan/Mute/Solo/Master) der laufenden Wiedergabe aktuell:
 * jede Änderung an `present` wird auf die Audio-Knoten gespiegelt.
 */
export function useLiveMix(): void {
  useEffect(() => {
    const unsub = useProject.subscribe((state, prev) => {
      if (state.present !== prev.present) engine.updateMix(state.present);
    });
    return unsub;
  }, []);
}
