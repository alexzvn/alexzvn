// Headless-Test des Export-Planers: baut eine Timeline (gemischte Auflösung/Fps,
// Kreuzblende, Audiospur, Titel-Overlay), gibt die ffmpeg-Args aus. Wird via
// esbuild gebündelt und mit node ausgeführt (siehe Verifikation im Plan).
import { buildPlan } from '../src/main/export/plan';
import { getVideoTrack, makeEmptyProject, newId, secToUs, type MediaAsset } from '../src/shared/project';

const A: MediaAsset = {
  id: 'a_a', path: '/tmp/jmedA.mp4', fileName: 'jmedA.mp4', kind: 'video',
  durationUs: secToUs(5), hasVideo: true, hasAudio: true, width: 1280, height: 720, fps: 30,
};
const B: MediaAsset = {
  id: 'a_b', path: '/tmp/jmedB.mp4', fileName: 'jmedB.mp4', kind: 'video',
  durationUs: secToUs(5), hasVideo: true, hasAudio: true, width: 1920, height: 1080, fps: 25,
};
const M: MediaAsset = {
  id: 'a_m', path: '/tmp/jmedM.m4a', fileName: 'jmedM.m4a', kind: 'audio',
  durationUs: secToUs(8), hasVideo: false, hasAudio: true,
};

const project = makeEmptyProject('Test');
project.assets.push(A, B, M);

const video = getVideoTrack(project)!;
video.clips.push(
  { id: newId('clip'), kind: 'media', assetId: A.id, inUs: 0, outUs: secToUs(5), startUs: 0, gain: 1, transform: { scaleMode: 'fit' }, enabled: true },
  { id: newId('clip'), kind: 'media', assetId: B.id, inUs: 0, outUs: secToUs(5), startUs: secToUs(5), gain: 1, transform: { scaleMode: 'fit' }, transitionIn: { kind: 'dissolve', durationUs: secToUs(1) }, enabled: true },
);

const audio = project.tracks.find((t) => t.kind === 'audio')!;
audio.clips.push({ id: newId('clip'), kind: 'media', assetId: M.id, inUs: 0, outUs: secToUs(8), startUs: 0, gain: 0.5, enabled: true });

const overlay = project.tracks.find((t) => t.kind === 'overlay')!;
const titleClipId = newId('clip');
overlay.clips.push({ id: titleClipId, kind: 'title', inUs: 0, outUs: secToUs(3), startUs: secToUs(1), title: { text: 'Test', style: { fontSize: 56, color: '#fff', background: '#000c', x: 0.07, y: 0.86, bold: true } }, enabled: true });

const titleFiles = new Map<string, string>([[titleClipId, '/tmp/jmedTitle.png']]);
const { args, totalSec } = buildPlan({ project, titleFiles, encoder: 'libx264' });

console.log(JSON.stringify({ args, totalSec }));
