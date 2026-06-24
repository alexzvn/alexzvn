import { useEffect } from 'react';
import { useProject } from '@/store/project';
import { startRecFlow, stopRecFlow } from './recording';

/**
 * TCP-Fernsteuerung (Bitfocus Companion) ↔ Renderer. Führt Befehle vom Main auf
 * die bestehenden Store-/Aufnahme-Pfade aus und meldet Transport-/Aufnahme-
 * Zustand zurück (über JSON dedupliziert). In App() einmalig montiert.
 */
export function useRemoteControl(): void {
  useEffect(() => {
    const off = window.jmdaw.remote.onCommand((cmd) => {
      const st = useProject.getState();
      switch (cmd.t) {
        case 'play':
          st.setPlaying(true);
          break;
        case 'stop':
          st.setPlaying(false);
          break;
        case 'toggle':
          st.setPlaying(!st.playing);
          break;
        case 'rec':
          if (cmd.mode === 'off') void stopRecFlow();
          else if (cmd.mode === 'on') void startRecFlow();
          else st.rec.status === 'recording' ? void stopRecFlow() : void startRecFlow();
          break;
      }
    });

    let last = '';
    const report = (): void => {
      const s = useProject.getState();
      const snap = { playing: s.playing, recording: s.rec.status === 'recording' };
      const json = JSON.stringify(snap);
      if (json !== last) {
        last = json;
        void window.jmdaw.remote.reportState(snap);
      }
    };
    const unsub = useProject.subscribe(report);
    report();

    return () => {
      off();
      unsub();
    };
  }, []);
}
