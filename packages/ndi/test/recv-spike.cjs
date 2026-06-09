// Receive-Spike: findet NDI-Quellen, verbindet sich mit einer und pollt ~5 s lang
// Frames. Beweist Build + ABI + DLL-Load + Receive auf Windows — bevor der echte
// Switcher-Input-Pfad angedockt wird.
//
//   node test/recv-spike.cjs                  → erste gefundene Quelle
//   node test/recv-spike.cjs "HOST (Quelle)"  → bestimmte Quelle (Name in Anführungszeichen)
//
// Test-Sender: NDI Studio Monitor (Test Pattern) oder die JM NDI Screen Capture.

const ndi = require('..');

ndi.init();

console.log('Suche NDI-Quellen (2 s)…');
const sources = ndi.findSources(2000);
if (!sources.length) {
  console.log('Keine NDI-Quelle gefunden — einen Sender laufen lassen (Studio Monitor / JM NDI Screen Capture).');
  ndi.destroy();
  process.exit(0);
}
console.log('Gefundene Quellen:');
sources.forEach((s, i) => console.log(`  [${i}] ${s}`));

const target = process.argv[2] || sources[0];
console.log(`\nVerbinde mit: ${target}`);
if (!ndi.createReceiver(target)) {
  console.log('createReceiver fehlgeschlagen.');
  ndi.destroy();
  process.exit(1);
}

const until = Date.now() + 5000;
let vCount = 0;
let aCount = 0;
let firstVideo = null;
let firstAudio = null;

while (Date.now() < until) {
  const f = ndi.receive(100);
  if (!f) continue;
  if (f.type === 'video') {
    vCount++;
    if (!firstVideo) {
      firstVideo = {
        w: f.width,
        h: f.height,
        stride: f.lineStride,
        fourCC: f.fourCC,
        fps: `${f.fpsN}/${f.fpsD}`,
        bytes: f.data.length,
      };
    }
  } else if (f.type === 'audio') {
    aCount++;
    if (!firstAudio) firstAudio = { channels: f.channels, samples: f.samples, sampleRate: f.sampleRate };
  }
}

console.log(`\nVideo-Frames: ${vCount}`, firstVideo || '(keine)');
console.log(`Audio-Frames: ${aCount}`, firstAudio || '(keine)');
console.log('\nErwartung: bei aktivem Sender > 0 Video-Frames mit plausibler Auflösung.');

ndi.closeReceiver();
ndi.destroy();
process.exit(0);
