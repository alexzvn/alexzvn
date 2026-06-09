// Persistierte Switcher-Einstellungen (localStorage). Geteilt zwischen dem
// Einstellungen-Tab und der Hauptansicht (Stream-Start-Button).
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_CONTROL_PORT } from '@jm/companion-protocol';

export interface SettingsState {
  /** RTMP-Ziel (rtmp://server/app/streamkey). */
  rtmpUrl: string;
  /** Stream-Videobitrate in kbit/s (x264 -b:v). */
  streamBitrateKbps: number;
  /** TCP-Fernsteuerung (Companion) aktiv? */
  controlEnabled: boolean;
  /** Port des Steuerservers. */
  controlPort: number;
  setRtmpUrl: (v: string) => void;
  setStreamBitrateKbps: (v: number) => void;
  setControlEnabled: (v: boolean) => void;
  setControlPort: (v: number) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      rtmpUrl: '',
      streamBitrateKbps: 4500,
      controlEnabled: false,
      controlPort: DEFAULT_CONTROL_PORT,
      setRtmpUrl: (rtmpUrl) => set({ rtmpUrl }),
      setStreamBitrateKbps: (streamBitrateKbps) =>
        set({ streamBitrateKbps: Math.min(20000, Math.max(500, Math.round(streamBitrateKbps) || 0)) }),
      setControlEnabled: (controlEnabled) => set({ controlEnabled }),
      setControlPort: (controlPort) =>
        set({ controlPort: Math.min(65535, Math.max(1, Math.round(controlPort) || DEFAULT_CONTROL_PORT)) }),
    }),
    { name: 'jmswitch-settings' },
  ),
);
