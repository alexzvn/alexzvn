import { mediaUrl } from '@shared/media-url';
import { clipEndUs, getVideoTrack, type Clip, type MediaAsset, type Project } from '@shared/project';

/** Abspiel-URL: Proxy bevorzugen (browser-dekodierbar), sonst Original. */
export function playbackUrl(asset: MediaAsset): string {
  return mediaUrl(asset.proxyPath ?? asset.path);
}

/** Aktiver Videoclip (+ Asset) unter dem Playhead, oder null (Lücke/leer). */
export function activeVideoClip(
  project: Project,
  playheadUs: number,
): { clip: Clip; asset: MediaAsset } | null {
  const track = getVideoTrack(project);
  if (!track) return null;
  const clip = track.clips.find((c) => playheadUs >= c.startUs && playheadUs < clipEndUs(c));
  if (!clip || !clip.assetId) return null;
  const asset = project.assets.find((a) => a.id === clip.assetId);
  if (!asset) return null;
  return { clip, asset };
}

/** Aktive Titel-Clips unter dem Playhead (Overlay-Spuren). */
export function activeTitles(project: Project, playheadUs: number): Clip[] {
  const out: Clip[] = [];
  for (const track of project.tracks) {
    if (track.kind !== 'overlay') continue;
    for (const clip of track.clips) {
      if (clip.title && playheadUs >= clip.startUs && playheadUs < clipEndUs(clip)) out.push(clip);
    }
  }
  return out;
}

/** Timeline-Position (µs) → Quell-Zeit (Sekunden) im Clip-Asset. */
export function sourceTimeSec(clip: Clip, playheadUs: number): number {
  const offset = playheadUs - clip.startUs;
  return Math.max(0, (clip.inUs + offset) / 1_000_000);
}
