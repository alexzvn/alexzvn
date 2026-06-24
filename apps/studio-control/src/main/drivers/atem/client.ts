import { Atem, AtemStateUtil, Enums, type AtemState } from 'atem-connection';
import type { AtemCommand, AtemConfig, AtemStatus } from '@shared/atem';

// Gesteuerte Mischstufe (M/E 1). atem-connection verbindet selbst per UDP 9910
// und reconnectet automatisch. Event-getrieben — kein Polling.
const ME = 0;

export class AtemClient {
  private readonly atem = new Atem();
  private status: AtemStatus;
  private closed = false;

  constructor(
    private readonly cfg: AtemConfig,
    private readonly onStatus: (s: AtemStatus) => void,
  ) {
    this.status = { id: cfg.id, state: 'connecting', lastChecked: 0 };

    this.atem.on('connected', () => this.refresh('connected'));
    this.atem.on('disconnected', () => {
      if (this.closed) return;
      this.patch({ state: 'connecting', program: undefined, preview: undefined, recording: undefined, streaming: undefined });
    });
    this.atem.on('stateChanged', () => {
      if (this.status.state === 'connected') this.refresh('connected');
    });
    this.atem.on('error', (e: string) => this.patch({ lastError: e }));

    this.atem.connect(cfg.host).catch((err: unknown) => {
      this.patch({ state: 'down', lastError: (err as Error)?.message ?? String(err) });
    });
  }

  private refresh(state: AtemStatus['state']): void {
    const s = this.atem.state;
    if (!s) {
      this.patch({ state });
      return;
    }
    const me = AtemStateUtil.getMixEffect(s, ME);
    this.patch({
      state,
      lastError: undefined,
      model: s.info.productIdentifier,
      program: me.programInput,
      preview: me.previewInput,
      recording: recOn(s),
      streaming: streamOn(s),
    });
  }

  private patch(p: Partial<AtemStatus>): void {
    this.status = { ...this.status, ...p, lastChecked: Date.now() };
    this.onStatus(this.status);
  }

  getStatus(): AtemStatus {
    return this.status;
  }

  async execute(cmd: AtemCommand): Promise<void> {
    switch (cmd.type) {
      case 'program':
        await this.atem.changeProgramInput(cmd.input, ME);
        break;
      case 'preview':
        await this.atem.changePreviewInput(cmd.input, ME);
        break;
      case 'cut':
        await this.atem.cut(ME);
        break;
      case 'auto':
        await this.atem.autoTransition(ME);
        break;
      case 'ftb':
        await this.atem.fadeToBlack(ME);
        break;
      case 'key': {
        const on = cmd.on ?? !keyOn(this.atem.state, cmd.keyer);
        await this.atem.setUpstreamKeyerOnAir(on, ME, cmd.keyer);
        break;
      }
      case 'record': {
        const on = cmd.on ?? !this.status.recording;
        if (on) await this.atem.startRecording();
        else await this.atem.stopRecording();
        break;
      }
      case 'stream': {
        const on = cmd.on ?? !this.status.streaming;
        if (on) await this.atem.startStreaming();
        else await this.atem.stopStreaming();
        break;
      }
    }
  }

  dispose(): void {
    this.closed = true;
    this.atem.disconnect().catch(() => {});
  }
}

function recOn(s: AtemState): boolean | undefined {
  const st = s.recording?.status?.state;
  return st === undefined ? undefined : (st & Enums.RecordingStatus.Recording) !== 0;
}
function streamOn(s: AtemState): boolean | undefined {
  const st = s.streaming?.status?.state;
  return st === undefined ? undefined : (st & Enums.StreamingStatus.Streaming) !== 0;
}
function keyOn(s: AtemState | undefined, keyer: number): boolean {
  if (!s) return false;
  return AtemStateUtil.getMixEffect(s, ME).upstreamKeyers[keyer]?.onAir ?? false;
}
