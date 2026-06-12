import net from 'node:net';
import dgram from 'node:dgram';

// Emulates the control endpoints of both desks + an OSC bridge so the audio
// driver can be smoke-tested headless without hardware:
//   TCP 49280 — Yamaha RCP (logs ASCII lines, answers OK / product name)
//   TCP 51325 — Allen & Heath SQ MIDI (logs raw bytes as hex)
//   UDP 8000  — OSC bridge (decodes address + args)

// --- Yamaha RCP ---
net
  .createServer((sock) => {
    let buf = '';
    sock.on('data', (d) => {
      buf += d.toString('ascii');
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        console.log(`[mock-audio yamaha] ${line}`);
        if (line.startsWith('devinfo')) sock.write('OK devinfo productname "QL1"\n');
        else sock.write(`OK ${line}\n`);
      }
    });
  })
  .listen(49280, () => console.log('[mock-audio] Yamaha RCP on tcp:49280'));

// --- Allen & Heath SQ MIDI ---
net
  .createServer((sock) => {
    sock.on('data', (d) => {
      console.log(`[mock-audio ah-sq] ${[...d].map((b) => b.toString(16).padStart(2, '0')).join(' ')}`);
    });
  })
  .listen(51325, () => console.log('[mock-audio] A&H SQ MIDI on tcp:51325'));

// --- OSC bridge ---
function readOscString(buf: Buffer, off: number): [string, number] {
  let end = off;
  while (end < buf.length && buf[end] !== 0) end++;
  const s = buf.toString('ascii', off, end);
  const next = off + Math.ceil((s.length + 1) / 4) * 4;
  return [s, next];
}
dgram
  .createSocket('udp4')
  .on('message', (msg) => {
    try {
      const [address, afterAddr] = readOscString(msg, 0);
      const [tags, afterTags] = readOscString(msg, afterAddr);
      let off = afterTags;
      const args: Array<number | string> = [];
      for (const t of tags.slice(1)) {
        if (t === 'i') { args.push(msg.readInt32BE(off)); off += 4; }
        else if (t === 'f') { args.push(Number(msg.readFloatBE(off).toFixed(2))); off += 4; }
        else if (t === 's') { const [s, n] = readOscString(msg, off); args.push(s); off = n; }
      }
      console.log(`[mock-audio osc] ${address} ${JSON.stringify(args)}`);
    } catch {
      console.log('[mock-audio osc] (undecodable packet)');
    }
  })
  .bind(8000, () => console.log('[mock-audio] OSC bridge on udp:8000'));
