/**
 * Wraps bytes in a Blob. Copies into a fresh ArrayBuffer-backed view so the type
 * satisfies the DOM `BlobPart` contract regardless of whether the source buffer
 * is an ArrayBuffer or SharedArrayBuffer (TypeScript's typed-array generics).
 */
export function bytesToBlob(bytes: Uint8Array, type?: string): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy], type ? { type } : undefined);
}
