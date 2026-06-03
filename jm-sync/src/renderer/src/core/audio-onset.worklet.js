// Self-contained AudioWorkletProcessor for beep-onset detection (audio thread).
// Loaded via `audioWorklet.addModule(<this file>?url)`. Kept as plain JS with no
// imports so it bundles identically in the Electron and PWA builds.
//
// ⚠️ The DSP here MIRRORS core/audio-onset-core.ts (the testable twin). Keep both
// in sync — audio-onset-core.ts is what the Node self-test verifies.

function goertzelCoeff(targetFreq, sampleRate, windowSize) {
  const k = Math.round((windowSize * targetFreq) / sampleRate);
  const omega = (2 * Math.PI * k) / windowSize;
  return 2 * Math.cos(omega);
}

function goertzelMagnitude(buf, start, N, coeff) {
  let s1 = 0;
  let s2 = 0;
  for (let i = 0; i < N; i++) {
    const s0 = buf[start + i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  const power = s1 * s1 + s2 * s2 - coeff * s1 * s2;
  return Math.sqrt(Math.max(0, power)) / N;
}

class OnsetCore {
  constructor(opts) {
    this.opts = opts;
    this.coeff = goertzelCoeff(opts.targetFreq, opts.sampleRate, opts.windowSize);
    this.buffer = [];
    this.bufferStart = 0;
    this.nextWindow = 0;
    this.baseline = 0;
    this.lastFire = -Infinity;
    this.armed = true;
  }

  push(samples, firstSampleIndex) {
    if (this.buffer.length === 0) {
      this.bufferStart = firstSampleIndex;
      this.nextWindow = firstSampleIndex;
    }
    for (let i = 0; i < samples.length; i++) this.buffer.push(samples[i]);

    const onsets = [];
    const { windowSize, hopSize, riseFactor, floor, baselineDecay, refractorySamples } = this.opts;

    while (this.nextWindow + windowSize <= this.bufferStart + this.buffer.length) {
      const local = this.nextWindow - this.bufferStart;
      const mag = goertzelMagnitude(this.buffer, local, windowSize, this.coeff);
      const onsetIdx = this.nextWindow;

      const threshold = Math.max(floor, this.baseline * riseFactor);
      if (this.armed && mag >= threshold && onsetIdx - this.lastFire >= refractorySamples) {
        onsets.push(onsetIdx);
        this.lastFire = onsetIdx;
        this.armed = false;
      }
      if (!this.armed && mag < Math.max(floor, this.baseline * 1.5)) this.armed = true;
      if (this.armed) this.baseline += (mag - this.baseline) * baselineDecay;

      this.nextWindow += hopSize;
    }

    const keepFrom = this.nextWindow - this.bufferStart - windowSize;
    if (keepFrom > 0) {
      this.buffer.splice(0, keepFrom);
      this.bufferStart += keepFrom;
    }
    return onsets;
  }
}

function defaultOnsetOptions(sr, targetFreq) {
  const windowSize = Math.max(64, Math.round(sr * 0.01));
  return {
    sampleRate: sr,
    targetFreq: targetFreq || 1000,
    windowSize,
    hopSize: windowSize >> 1,
    riseFactor: 4,
    floor: 0.02,
    refractorySamples: Math.round(sr * 0.3),
    baselineDecay: 0.1,
  };
}

class BeepOnsetProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const po = (options && options.processorOptions) || {};
    this.core = new OnsetCore(defaultOnsetOptions(sampleRate, po.targetFreq));
    this.total = 0;
    this.anchorCtxTime = NaN;
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel || channel.length === 0) return true;

    if (Number.isNaN(this.anchorCtxTime)) this.anchorCtxTime = currentTime;

    const onsets = this.core.push(channel, this.total);
    this.total += channel.length;

    for (let i = 0; i < onsets.length; i++) {
      const timeSec = this.anchorCtxTime + onsets[i] / sampleRate;
      this.port.postMessage({ type: 'onset', timeSec });
    }
    return true;
  }
}

registerProcessor('beep-onset', BeepOnsetProcessor);
