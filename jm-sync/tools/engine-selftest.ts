// Standalone verification of the framework-neutral engine math against synthetic
// signals. Run: `npm run selftest`. No DOM / AudioWorklet needed — these are the
// same pure functions the browser detectors use.

import { median, mad, computeStats } from '../src/renderer/src/core/stats';
import { RisingEdgeDetector } from '../src/renderer/src/core/edge';
import { OnsetCore, defaultOnsetOptions } from '../src/renderer/src/core/audio-onset-core';
import { Correlator } from '../src/renderer/src/core/correlator';

let passed = 0;
function check(name: string, cond: boolean, detail = ''): void {
  if (!cond) {
    console.error(`✗ ${name} ${detail}`);
    process.exitCode = 1;
  } else {
    passed++;
    console.log(`✓ ${name} ${detail}`);
  }
}
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

// --- stats ----------------------------------------------------------------
check('median odd', median([3, 1, 2]) === 2);
check('median even', median([1, 2, 3, 4]) === 2.5);
check('mad', mad([10, 10, 12, 8]) === 1);

const s = computeStats([9, 10, 10, 10, 11, 200])!;
check('computeStats rejects outlier', s.count === 5 && near(s.medianMs, 10, 0.001), `count=${s.count} med=${s.medianMs}`);

// --- rising-edge detector (sub-frame interpolation) -----------------------
{
  const det = new RisingEdgeDetector();
  const dt = 1000 / 60; // 60 fps
  const crossings: number[] = [];
  let t = 0;
  const push = (v: number) => {
    const c = det.push(v, t);
    if (c != null) crossings.push(c);
    t += dt;
  };
  for (let i = 0; i < 30; i++) push(0.1); // establish dark baseline
  const tBeforePulse = t - dt; // time of last dark frame
  push(0.9); // flash → expect crossing ~ midpoint between last dark and this frame
  for (let i = 0; i < 10; i++) push(0.9); // stay bright
  for (let i = 0; i < 20; i++) push(0.1); // dark again (re-arm)
  push(0.9); // second flash
  for (let i = 0; i < 10; i++) push(0.9);

  check('edge: two flashes detected', crossings.length === 2, `got ${crossings.length}`);
  check(
    'edge: sub-frame interpolation',
    near(crossings[0], tBeforePulse + dt * 0.5, 1),
    `cross=${crossings[0]?.toFixed(2)} expected≈${(tBeforePulse + dt * 0.5).toFixed(2)}`,
  );
}

// --- Goertzel onset core --------------------------------------------------
{
  const sr = 48000;
  const opts = defaultOnsetOptions(sr, 1000);
  const core = new OnsetCore(opts);
  const total = sr; // 1 s
  const burstStart = 24000;
  const burstLen = Math.round(sr * 0.03);
  const signal = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    let v = (Math.sin(i) * 1e-4); // negligible noise
    if (i >= burstStart && i < burstStart + burstLen) {
      v += 0.5 * Math.sin((2 * Math.PI * 1000 * i) / sr);
    }
    signal[i] = v;
  }
  const onsets: number[] = [];
  for (let i = 0; i < total; i += 128) {
    const block = signal.subarray(i, Math.min(i + 128, total));
    for (const o of core.push(block, i)) onsets.push(o);
  }
  check('onset: exactly one burst detected', onsets.length === 1, `got ${onsets.length}`);
  check(
    'onset: located near burst start',
    onsets.length > 0 && near(onsets[0], burstStart, opts.windowSize * 2),
    `onset=${onsets[0]} expected≈${burstStart}`,
  );

  const silentCore = new OnsetCore(defaultOnsetOptions(sr, 1000));
  const silent: number[] = [];
  const noise = new Float32Array(2048).map((_, i) => Math.sin(i) * 1e-4);
  for (let i = 0; i < 24; i++) for (const o of silentCore.push(noise, i * 2048)) silent.push(o);
  check('onset: no false positive on noise', silent.length === 0, `got ${silent.length}`);
}

// --- correlator -----------------------------------------------------------
{
  const c = new Correlator();
  // audio arrives 5 ms before video → offset should read +5 (audio leads).
  for (let k = 0; k < 6; k++) {
    const base = 1000 + k * 2000;
    c.addFlash(base);
    c.addBeep(base - 5);
  }
  const st = c.stats()!;
  check('correlator: pairs all cycles', st.count === 6, `count=${st.count}`);
  check('correlator: +5 ms (audio leads)', near(st.medianMs, 5, 0.001), `median=${st.medianMs}`);
}

console.log(`\n${passed} checks passed.`);
