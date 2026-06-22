import type { AudioDevice } from '@shared/ipc-types';
import { useProject } from '@/store/project';

export function listDevices(): Promise<AudioDevice[]> {
  return window.jmdaw.rec.listDevices();
}

export async function armFlow(): Promise<void> {
  const { rec } = useProject.getState();
  if (rec.deviceIndex == null) {
    useProject.getState().setRecError('Kein Eingang gewählt.');
    return;
  }
  const res = await window.jmdaw.rec.arm({
    device: rec.deviceIndex,
    channels: rec.channels,
    sampleRate: rec.sampleRate,
  });
  useProject.getState().setRecError(res.ok ? undefined : res.error);
}

export async function disarmFlow(): Promise<void> {
  await window.jmdaw.rec.disarm();
}

export async function startRecFlow(): Promise<void> {
  const st = useProject.getState();
  st.markRecStart();
  const res = await window.jmdaw.rec.start({});
  if (!res.ok) st.setRecError(res.error);
}

/** Aufnahme stoppen → WAV als Asset importieren + Clip an Startposition setzen. */
export async function stopRecFlow(): Promise<void> {
  const res = await window.jmdaw.rec.stop();
  if (!res.ok || !res.filePath) {
    useProject.getState().setRecError(res.error ?? 'Aufnahme fehlgeschlagen.');
    return;
  }
  const assets = await window.jmdaw.media.import([res.filePath]);
  if (assets[0]) useProject.getState().placeRecordedAsset(assets[0]);
}
