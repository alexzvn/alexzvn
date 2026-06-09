// Persistierte Switcher-Einstellungen (localStorage). Geteilt zwischen dem
// Einstellungen-Tab und der Hauptansicht (Stream-Start-Button).
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SettingsState {
  /** RTMP-Ziel (rtmp://server/app/streamkey). */
  rtmpUrl: string;
  /** Stream-Videobitrate in kbit/s (x264 -b:v). */
  streamBitrateKbps: number;
  setRtmpUrl: (v: string) => void;
  setStreamBitrateKbps: (v: number) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      rtmpUrl: '',
      streamBitrateKbps: 4500,
      setRtmpUrl: (rtmpUrl) => set({ rtmpUrl }),
      setStreamBitrateKbps: (streamBitrateKbps) =>
        set({ streamBitrateKbps: Math.min(20000, Math.max(500, Math.round(streamBitrateKbps) || 0)) }),
    }),
    { name: 'jmswitch-settings' },
  ),
);
