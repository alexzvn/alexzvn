import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { hashFile } from './hash';

let tmpFile: string;
let data: Buffer;

beforeAll(async () => {
  data = randomBytes(256 * 1024 + 123); // spans multiple 1 MiB-aware chunks edge
  tmpFile = path.join(os.tmpdir(), `jm-copy-hash-${process.pid}.bin`);
  await fs.writeFile(tmpFile, data);
});

afterAll(async () => {
  await fs.rm(tmpFile, { force: true });
});

describe('hashFile', () => {
  it('produces a 16-hex-char xxHash64 and is deterministic', async () => {
    const a = await hashFile(tmpFile, false);
    const b = await hashFile(tmpFile, false);
    expect(a.xxhash64).toMatch(/^[0-9a-f]{16}$/);
    expect(a.xxhash64).toBe(b.xxhash64);
    expect(a.md5).toBeUndefined();
  });

  it('matches Node crypto MD5 when requested', async () => {
    const { md5 } = await hashFile(tmpFile, true);
    const expected = createHash('md5').update(data).digest('hex');
    expect(md5).toBe(expected);
  });

  it('reports bytes read via the callback', async () => {
    let seen = 0;
    await hashFile(tmpFile, false, (n) => (seen += n));
    expect(seen).toBe(data.length);
  });
});
