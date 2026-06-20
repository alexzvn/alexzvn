import { getPreset } from '@shared/presets';
import type { ImportKind, TitleImage } from '@shared/ipc-types';
import { projectDurationUs } from '@shared/project';
import { useProject } from '@/store/project';
import { titleDataUrl } from './title-render';

export async function openProjectFlow(): Promise<void> {
  const res = await window.jmed.project.open();
  if (res) useProject.getState().loadProject(res.path, res.project);
}

export async function saveProjectFlow(saveAs = false): Promise<void> {
  const st = useProject.getState();
  const path = saveAs ? undefined : st.filePath ?? undefined;
  const res = await window.jmed.project.save({ project: st.present, path });
  if (res) useProject.setState({ filePath: res.path, dirty: false });
}

export async function importMediaFlow(kind: ImportKind): Promise<void> {
  const paths = await window.jmed.dialog.importMedia(kind);
  if (paths.length === 0) return;
  const assets = await window.jmed.media.import(paths);
  if (assets.length === 0) return;
  useProject.getState().addAssets(assets);
  // Proxy-Erzeugung anstoßen (Main entscheidet, ob nötig) + UI auf „building".
  for (const asset of assets) {
    if (asset.kind === 'video') {
      useProject.setState((s) => ({ proxies: { ...s.proxies, [asset.id]: { state: 'building', percent: 0 } } }));
    }
    void window.jmed.proxy.ensure(asset);
  }
}

export function collectTitleImages(): TitleImage[] {
  const { present } = useProject.getState();
  const { width, height } = present.export;
  const images: TitleImage[] = [];
  for (const track of present.tracks) {
    if (track.kind !== 'overlay') continue;
    for (const clip of track.clips) {
      if (clip.title) images.push({ clipId: clip.id, dataUrl: titleDataUrl(clip.title, width, height) });
    }
  }
  return images;
}

export async function startExportFlow(): Promise<void> {
  const st = useProject.getState();
  if (projectDurationUs(st.present) === 0) {
    st.setExportStatus({ running: false, error: 'Timeline ist leer.' });
    return;
  }
  const preset = getPreset(st.present.export.presetId);
  const ext = preset?.container ?? 'mp4';
  const defaultName = (st.filePath ? st.present.name : st.present.name) || 'Export';
  const outputPath = await window.jmed.export.pickOutput({ defaultName, ext });
  if (!outputPath) return;

  const titleImages = collectTitleImages();
  st.setExportStatus({ running: true, percent: 0, error: undefined, message: 'Export läuft …', lastOutput: undefined });
  const { exportId } = await window.jmed.export.start({ project: st.present, outputPath, titleImages });
  st.setExportStatus({ exportId });
}

export function cancelExportFlow(): void {
  const { exportStatus } = useProject.getState();
  if (exportStatus.exportId) void window.jmed.export.cancel(exportStatus.exportId);
}
