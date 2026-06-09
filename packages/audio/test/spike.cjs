// Spike-CLI: prüft den Audio-Capture-Pfad ohne Electron.
//   1) listet Host-APIs + Geräte (hebt ASIO / Dante hervor)
//   2) öffnet das gewählte Gerät mehrkanalig
//   3) misst ~5 s lang den Spitzenpegel pro Kanal (einfache dBFS-Anzeige)
//
// Aufruf:
//   node test/spike.cjs                 → nur Geräte auflisten
//   node test/spike.cjs <dev> [ch] [sr] → aufnehmen (dev=Index, ch=Kanäle, sr=Rate)
//   z. B.: node test/spike.cjs 3 16 48000
//
// Erwartet ein gebautes Addon (npm run rebuild -w @jm/audio, PORTAUDIO_DIR gesetzt).

const audio = require('..');

function dbfs(peak) {
  if (peak <= 0) return '-inf';
  return (20 * Math.log10(peak)).toFixed(1);
}

audio.init();

const apis = audio.listHostApis();
console.log('\n=== Host-APIs ===');
for (const a of apis) {
  const mark = /asio/i.test(a.name) ? '  ← ASIO' : '';
  console.log(`  [${a.index}] ${a.name} (${a.deviceCount} Geräte)${mark}`);
}

const devices = audio.listDevices();
console.log('\n=== Geräte (mit Eingängen) ===');
for (const d of devices) {
  if (d.maxInputChannels <= 0) continue;
  const dante = /dante/i.test(d.name) ? '  ← Dante' : '';
  console.log(
    `  [${d.index}] ${d.name} — in:${d.maxInputChannels} ` +
      `@${Math.round(d.defaultSampleRate)}Hz via ${d.hostApiName}${dante}`,
  );
}

const dev = process.argv[2] != null ? Number(process.argv[2]) : null;
if (dev == null) {
  console.log('\nKein Geräteindex übergeben — nur Auflistung. Aufnahme: node test/spike.cjs <dev> [ch] [sr]\n');
  audio.terminate();
  process.exit(0);
}

const ch = process.argv[3] != null ? Number(process.argv[3]) : 2;
const sr = process.argv[4] != null ? Number(process.argv[4]) : 48000;

console.log(`\n=== Aufnahme: Gerät ${dev}, ${ch} Kanäle @ ${sr} Hz (5 s) ===`);
const peaks = new Float64Array(ch);
let blocks = 0;
let totalFrames = 0;

audio.openInput({ device: dev, channels: ch, sampleRate: sr }, (planar, channels, frames) => {
  blocks++;
  totalFrames += frames;
  for (let c = 0; c < channels; c++) {
    const base = c * frames;
    let p = peaks[c];
    for (let i = 0; i < frames; i++) {
      const v = Math.abs(planar[base + i]);
      if (v > p) p = v;
    }
    peaks[c] = p;
  }
});

setTimeout(() => {
  audio.stopInput();
  audio.terminate();
  console.log(`\n${blocks} Blöcke, ${totalFrames} Frames (~${(totalFrames / sr).toFixed(2)} s)`);
  console.log('Spitzenpegel pro Kanal (dBFS):');
  for (let c = 0; c < ch; c++) {
    console.log(`  ch${String(c).padStart(2, '0')}: ${dbfs(peaks[c]).padStart(7)} dBFS  ${peaks[c] > 0 ? '●' : '·'}`);
  }
  console.log('\nErwartung: bei anliegendem Dante-Signal zeigen die belegten Kanäle Pegel > -inf.\n');
  process.exit(0);
}, 5000);
