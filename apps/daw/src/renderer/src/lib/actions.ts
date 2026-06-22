import { projectDurationUs } from '@shared/project';
import { useProject } from '@/store/project';
import { engine, encodeWavFloat32 } from '@/audio/engine';

export async function openProjectFlow(): Promise<void> {
  const res = await window.jmdaw.project.open();
  if (res) useProject.getState().loadProject(res.path, res.project);
}

export async function saveProjectFlow(saveAs = false): Promise<void> {
  const st = useProject.getState();
  const path = saveAs ? undefined : st.filePath ?? undefined;
  const res = await window.jmdaw.project.save({ project: st.present, path });
  if (res) useProject.setState({ filePath: res.path, dirty: false });
}

export async function importAudioFlow(): Promise<void> {
  const paths = await window.jmdaw.dialog.importAudio();
  if (paths.length === 0) return;
  const assets = await window.jmdaw.media.import(paths);
  if (assets.length === 0) return;
  useProject.getState().addAssets(assets);
}

export async function startExportFlow(): Promise<void> {
  const st = useProject.getState();
  if (projectDurationUs(st.present) === 0) {
    st.setExportStatus({ running: false, error: 'Timeline ist leer.' });
    return;
  }
  const ex = st.present.export;
  const defaultName = st.present.name || 'Export';
  const outputPath = await window.jmdaw.export.pickOutput({ defaultName, ext: ex.format });
  if (!outputPath) return;

  st.setExportStatus({ running: true, percent: 0, error: undefined, message: 'Mix wird gerendert …', lastOutput: undefined });
  try {
    const buffer = await engine.renderOffline(st.present);
    const wav = encodeWavFloat32(buffer);
    st.setExportStatus({ message: 'Datei wird geschrieben …' });
    const { exportId } = await window.jmdaw.export.start({
      wav,
      outputPath,
      format: ex.format,
      sampleRate: ex.sampleRate,
      bitDepth: ex.bitDepth,
      bitrateKbps: ex.bitrateKbps ?? null,
    });
    st.setExportStatus({ exportId });
  } catch (err) {
    st.setExportStatus({ running: false, error: (err as Error).message });
  }
}

export function cancelExportFlow(): void {
  const { exportStatus } = useProject.getState();
  if (exportStatus.exportId) void window.jmdaw.export.cancel(exportStatus.exportId);
}
