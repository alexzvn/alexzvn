// Main-thread wrapper around the beep-onset AudioWorklet. Wires a MediaStream's
// audio into the worklet and reports each beep onset on the performance clock so
// it shares a timeline with the video flash detector.

import workletUrl from './audio-onset.worklet.js?url';

export interface AudioOnsetOptions {
  targetFreq: number;
}

export const DEFAULT_AUDIO_OPTIONS: AudioOnsetOptions = { targetFreq: 1000 };

export class AudioOnsetDetector {
  private ctx: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private node: AudioWorkletNode | null = null;
  private sink: GainNode | null = null;
  private perf0 = 0;
  private ctx0 = 0;

  constructor(
    private readonly onBeep: (timeMs: number) => void,
    private readonly opts: AudioOnsetOptions = DEFAULT_AUDIO_OPTIONS,
  ) {}

  async start(stream: MediaStream): Promise<void> {
    if (stream.getAudioTracks().length === 0) {
      throw new Error('Quelle enthält keine Audiospur.');
    }
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    await ctx.audioWorklet.addModule(workletUrl);

    // Anchor the audioContext clock to the performance clock for cross-channel timing.
    const ot = ctx.getOutputTimestamp?.();
    if (ot && ot.contextTime && ot.performanceTime) {
      this.ctx0 = ot.contextTime;
      this.perf0 = ot.performanceTime;
    } else {
      this.perf0 = performance.now();
      this.ctx0 = ctx.currentTime;
    }

    const source = ctx.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(ctx, 'beep-onset', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      processorOptions: { targetFreq: this.opts.targetFreq },
    });
    node.port.onmessage = (ev: MessageEvent) => {
      const msg = ev.data as { type: string; timeSec: number };
      if (msg.type === 'onset') {
        this.onBeep(this.perf0 + (msg.timeSec - this.ctx0) * 1000);
      }
    };

    // Route through a muted gain so the graph is pulled (worklet runs) but stays silent.
    const sink = ctx.createGain();
    sink.gain.value = 0;
    source.connect(node);
    node.connect(sink);
    sink.connect(ctx.destination);

    this.ctx = ctx;
    this.source = source;
    this.node = node;
    this.sink = sink;
  }

  stop(): void {
    this.node?.port.close();
    this.source?.disconnect();
    this.node?.disconnect();
    this.sink?.disconnect();
    this.ctx?.close();
    this.ctx = null;
    this.source = null;
    this.node = null;
    this.sink = null;
  }
}
