// Media source helpers. Camera/mic and capture-card/audio-interface all surface
// as ordinary MediaDevices, so one getUserMedia path covers both; getDisplayMedia
// covers the desktop tab/screen quick-check.

export interface DeviceInfo {
  deviceId: string;
  label: string;
}

export interface DeviceLists {
  video: DeviceInfo[];
  audio: DeviceInfo[];
}

export async function listDevices(): Promise<DeviceLists> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const map = (kind: MediaDeviceKind, fallback: string) =>
    devices
      .filter((d) => d.kind === kind)
      .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `${fallback} ${i + 1}` }));
  return {
    video: map('videoinput', 'Kamera'),
    audio: map('audioinput', 'Mikrofon'),
  };
}

/** Camera + mic (or any selected video/audio input device). */
export async function getUserStream(videoId?: string, audioId?: string): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: videoId ? { deviceId: { exact: videoId } } : true,
    audio: audioId
      ? {
          deviceId: { exact: audioId },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        }
      : { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
}

/** Tab / screen capture with audio (desktop quick-check; less reliable). */
export async function getDisplayStream(): Promise<MediaStream> {
  return navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
}

export function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop());
}
