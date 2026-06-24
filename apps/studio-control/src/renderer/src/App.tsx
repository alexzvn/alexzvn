import { useEffect } from 'react';
import { connect, resolveServerUrl } from '@/sync/client';
import { useSession } from '@/store/session';
import { useApp } from '@/store/app';
import { EVENTS } from '@shared/protocol';
import type {
  AtemStatusEvent,
  AudioStatusEvent,
  AuditEntry,
  ObsStatusEvent,
  PtzStatusEvent,
  TricasterStatusEvent,
} from '@shared/protocol';
import type { Device, DiscoveredDevice } from '@shared/device';
import type { TricasterConfig } from '@shared/tricaster';
import type { PtzCameraConfig } from '@shared/ptz';
import type { LightingConfig } from '@shared/lighting';
import type { AudioConsoleConfig } from '@shared/audio';
import type { AtemConfig } from '@shared/atem';
import type { ObsConfig } from '@shared/obs';
import type { UserRow } from '@/types/admin';
import { AppShell } from '@/components/AppShell';
import { LoginView } from '@/views/Login';
import { SetupView } from '@/views/Setup';
import { VideoView } from '@/views/Video';
import { AudioView } from '@/views/Audio';
import { LichtView } from '@/views/Licht';

export function App() {
  const token = useSession((s) => s.token);
  const user = useSession((s) => s.user);
  const clearSession = useSession((s) => s.clearSession);
  const setConnected = useSession((s) => s.setConnected);
  const section = useApp((s) => s.section);

  useEffect(() => {
    if (!token && !window.jms?.isElectron) {
      // Browser client without session — show login. No socket yet.
      return;
    }

    const sock = connect(resolveServerUrl(), token, {
      onConnectionChange: setConnected,
      onError: (msg) => {
        if (msg === 'unauthorised') clearSession();
      },
      onState: (event, payload) => {
        const s = useApp.getState();
        switch (event) {
          case EVENTS.INVENTORY_STATE:
            s.setDevices((payload as { devices: Device[] }).devices);
            break;
          case EVENTS.TRICASTER_STATE: {
            const p = payload as {
              tricasters: TricasterConfig[];
              statuses: TricasterStatusEvent[];
            };
            s.setTricasters(p.tricasters, p.statuses);
            break;
          }
          case EVENTS.TRICASTER_STATUS:
            s.setTricasterStatus(payload as TricasterStatusEvent);
            break;
          case EVENTS.PTZ_STATE: {
            const p = payload as {
              cameras: PtzCameraConfig[];
              statuses: PtzStatusEvent[];
            };
            s.setPtzCameras(p.cameras, p.statuses);
            break;
          }
          case EVENTS.PTZ_STATUS:
            s.setPtzStatus(payload as PtzStatusEvent);
            break;
          case EVENTS.LIGHTING_STATE: {
            const p = payload as { config: LightingConfig; blackout: boolean };
            s.setLighting(p.config, p.blackout);
            break;
          }
          case EVENTS.AUDIO_STATE: {
            const p = payload as {
              consoles: AudioConsoleConfig[];
              statuses: AudioStatusEvent[];
            };
            s.setAudio(p.consoles, p.statuses);
            break;
          }
          case EVENTS.AUDIO_STATUS:
            s.setAudioStatus(payload as AudioStatusEvent);
            break;
          case EVENTS.ATEM_STATE: {
            const p = payload as { atem: AtemConfig[]; statuses: AtemStatusEvent[] };
            s.setAtem(p.atem, p.statuses);
            break;
          }
          case EVENTS.OBS_STATE: {
            const p = payload as { obs: ObsConfig[]; statuses: ObsStatusEvent[] };
            s.setObs(p.obs, p.statuses);
            break;
          }
          case EVENTS.DISCOVERY_START:
            s.setDiscoveryRunning(true);
            break;
          case EVENTS.DISCOVERY_RESULT:
            s.appendDiscoveryResults(
              (payload as { results: DiscoveredDevice[] }).results,
            );
            break;
          case EVENTS.DISCOVERY_DONE: {
            const p = payload as { count: number; durationMs: number };
            s.finishDiscovery(p.count, p.durationMs);
            break;
          }
          case EVENTS.AUDIT_APPEND:
            s.appendAudit(payload as AuditEntry);
            break;
          case 'audit:state':
            s.setAudit((payload as { entries: AuditEntry[] }).entries);
            break;
          case EVENTS.USERS_STATE:
            s.setUsers((payload as { users: UserRow[] }).users);
            break;
        }
      },
    });

    return () => {
      sock.disconnect();
    };
  }, [token, setConnected, clearSession]);

  if (!user) return <LoginView />;

  return (
    <AppShell>
      {section === 'video' && <VideoView />}
      {section === 'audio' && <AudioView />}
      {section === 'licht' && <LichtView />}
      {section === 'setup' && <SetupView />}
    </AppShell>
  );
}
