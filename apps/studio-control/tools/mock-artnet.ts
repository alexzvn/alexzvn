import dgram from 'node:dgram';

// Minimal Art-Net node emulator for headless testing of JM Studio Control's
// lighting engine. Binds UDP 6454, decodes ArtDmx (OpCode 0x5000) and logs the
// universe + the first few DMX channel values. Set CHANNELS to log more.
const PORT = 6454;
const CHANNELS = Number(process.env['CHANNELS'] ?? 8);

const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
const last = new Map<number, string>();

socket.on('message', (msg) => {
  if (msg.length < 18) return;
  if (msg.slice(0, 8).toString('ascii') !== 'Art-Net\0') return;
  const op = msg.readUInt16LE(8);
  if (op !== 0x5000) return; // OpDmx
  const subUni = msg.readUInt8(14);
  const net = msg.readUInt8(15);
  const universe = (net << 8) | subUni;
  const len = msg.readUInt16BE(16);
  const data = msg.subarray(18, 18 + len);
  const head = [...data.subarray(0, CHANNELS)].join(',');
  // Only log when the channel snapshot changes — the engine streams continuously.
  const key = `${universe}:${head}`;
  if (last.get(universe) !== key) {
    last.set(universe, key);
    console.log(`[mock-artnet] U${universe} len=${len} ch[1..${CHANNELS}]=${head}`);
  }
});

socket.on('error', (err) => {
  console.error('[mock-artnet] error', err.message);
});

socket.bind(PORT, () => {
  console.log(`[mock-artnet] listening for ArtDmx on :${PORT}`);
});
