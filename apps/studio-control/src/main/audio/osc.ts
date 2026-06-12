import type { OscMessage } from '@shared/audio';

// Minimal OSC 1.0 encoder (enough for the bridge transport): an address string,
// a comma type-tag string, then the arguments — each component padded to a
// 4-byte boundary with NUL bytes.

function oscString(s: string): Buffer {
  const raw = Buffer.from(s, 'ascii');
  const totalLen = raw.length + 1; // include the NUL terminator
  const pad = (4 - (totalLen % 4)) % 4;
  return Buffer.concat([raw, Buffer.alloc(1 + pad)]);
}

export function encodeOsc(msg: OscMessage): Buffer {
  const addr = oscString(msg.address);
  const tags = ',' + msg.args.map((a) => a.type).join('');
  const tagBuf = oscString(tags);
  const argBufs = msg.args.map((a) => {
    if (a.type === 'i') {
      const b = Buffer.alloc(4);
      b.writeInt32BE(Number(a.value) | 0);
      return b;
    }
    if (a.type === 'f') {
      const b = Buffer.alloc(4);
      b.writeFloatBE(Number(a.value));
      return b;
    }
    return oscString(String(a.value));
  });
  return Buffer.concat([addr, tagBuf, ...argBufs]);
}
