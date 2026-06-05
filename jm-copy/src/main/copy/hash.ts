import { createReadStream } from 'node:fs';
import { createXXHash64, createMD5 } from 'hash-wasm';
import type { HashAlgo } from '@shared/types';

export interface Hashes {
  xxhash64: string;
  md5?: string;
}

export interface RunningHash {
  update(chunk: Uint8Array): void;
  digest(): Hashes;
}

/** Create an incremental hasher — xxHash64 always, MD5 optionally alongside. */
export async function createRunningHash(withMd5: boolean): Promise<RunningHash> {
  const xx = await createXXHash64();
  xx.init();
  const md5 = withMd5 ? await createMD5() : null;
  md5?.init();
  return {
    update(chunk) {
      xx.update(chunk);
      md5?.update(chunk);
    },
    digest() {
      return {
        xxhash64: xx.digest('hex'),
        md5: md5 ? md5.digest('hex') : undefined,
      };
    },
  };
}

/** Hash a file from disk in 1 MiB chunks. Used for verify read-back and re-verify. */
export async function hashFile(
  path: string,
  withMd5: boolean,
  onBytes?: (n: number) => void,
): Promise<Hashes> {
  const hasher = await createRunningHash(withMd5);
  await new Promise<void>((resolve, reject) => {
    const rs = createReadStream(path, { highWaterMark: 1 << 20 });
    rs.on('data', (chunk: string | Buffer) => {
      const buf = chunk as Buffer;
      hasher.update(buf);
      onBytes?.(buf.length);
    });
    rs.on('end', () => resolve());
    rs.on('error', reject);
  });
  return hasher.digest();
}

/** Map an algo id to the hash value for comparison/MHL writing. */
export function hashValue(h: Hashes, algo: HashAlgo): string | undefined {
  return algo === 'xxhash64' ? h.xxhash64 : h.md5;
}
