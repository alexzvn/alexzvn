// Phase-1-Spike: sendet ein synthetisches bewegtes Testbild (BGRA) + 440-Hz-Ton
// (FLTP) als NDI-Quelle. Beweist Build + ABI + DLL-Load + Send-Semantik, BEVOR
// die echte Capture-Pipeline angedockt wird.
//
// Voraussetzung (Windows/Mac): NDI-SDK installiert, NDI_SDK_DIR gesetzt, Addon
// gebaut (`npm install` baut via Guard, oder `npm run rebuild -w @jm/ndi`).
// Lauf:   node packages/ndi/test/spike.cjs
// Prüfen: NDI Studio Monitor öffnen → Quelle "JM Capture (<host>) - Test Pattern".
// Beenden: Strg+C.

const os = require('node:os');
const ndi = require('..');

const W = 1280;
const H = 720;
const FPS = 30;
const SR = 48000;
const CH = 2;
const SAMPLES = Math.round(SR / FPS); // ~1600 Samples/Frame/Kanal

ndi.init();
ndi.createSender(`JM Capture (${os.hostname()}) - Test Pattern`);
console.log(`NDI-Sender aktiv (${W}x${H}@${FPS}, ${CH}ch/${SR}Hz). Strg+C zum Beenden.`);

const video = Buffer.alloc(W * H * 4); // BGRA
const audio = new Float32Array(CH * SAMPLES);
let frame = 0;
let phase = 0;

const timer = setInterval(() => {
  // Bewegtes 64px-Balkenmuster mit Farbverlauf
  const off = (frame * 6) % 128;
  for (let y = 0; y < H; y++) {
    const rowR = (y * 255 / H) | 0;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const bar = (((x + off) >> 6) & 1) ? 220 : 30;
      video[i] = bar;                 // B
      video[i + 1] = (x * 255 / W) | 0; // G
      video[i + 2] = rowR;            // R
      video[i + 3] = 255;             // A
    }
  }
  ndi.sendVideoBGRA(video, W, H, FPS, 1);

  // 440-Hz-Sinus, planar L/R
  for (let n = 0; n < SAMPLES; n++) {
    const s = Math.sin(phase) * 0.2;
    audio[n] = s;             // L
    audio[SAMPLES + n] = s;   // R
    phase += (2 * Math.PI * 440) / SR;
    if (phase > 2 * Math.PI) phase -= 2 * Math.PI;
  }
  ndi.sendAudioFLTP(audio, CH, SAMPLES, SR);

  if (frame % FPS === 0) {
    console.log(`t=${frame / FPS}s  Empfänger verbunden: ${ndi.connections()}`);
  }
  frame++;
}, Math.round(1000 / FPS));

process.on('SIGINT', () => {
  clearInterval(timer);
  ndi.destroy();
  console.log('\nBeendet.');
  process.exit(0);
});
