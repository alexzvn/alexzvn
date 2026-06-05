import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * MHL 1.1 (Media Hash List) sidecar — the single-file XML variant that
 * DaVinci Resolve, Silverstack, ShotPut Pro & co. read. xxHash64 is written as
 * <xxhash64be>; MD5 as <md5> when present.
 */

export interface MhlEntry {
  relPath: string;
  sizeBytes: number;
  xxhash64?: string;
  md5?: string;
  /** ISO timestamp the hash was taken. */
  hashDate?: string;
}

export interface MhlMeta {
  startISO: string;
  finishISO: string;
  tool: string;
  username?: string;
  hostname?: string;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Serialize entries + metadata into an MHL 1.1 document. Pure — easy to test. */
export function buildMhl(entries: MhlEntry[], meta: MhlMeta): string {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<hashlist version="1.1">');
  lines.push('  <creatorinfo>');
  lines.push(`    <name>${esc(meta.username ?? '')}</name>`);
  lines.push(`    <username>${esc(meta.username ?? '')}</username>`);
  lines.push(`    <hostname>${esc(meta.hostname ?? '')}</hostname>`);
  lines.push(`    <tool>${esc(meta.tool)}</tool>`);
  lines.push(`    <startdate>${esc(meta.startISO)}</startdate>`);
  lines.push(`    <finishdate>${esc(meta.finishISO)}</finishdate>`);
  lines.push('  </creatorinfo>');
  for (const e of entries) {
    lines.push('  <hash>');
    lines.push(`    <file>${esc(e.relPath)}</file>`);
    lines.push(`    <size>${e.sizeBytes}</size>`);
    if (e.xxhash64) lines.push(`    <xxhash64be>${e.xxhash64}</xxhash64be>`);
    if (e.md5) lines.push(`    <md5>${e.md5}</md5>`);
    if (e.hashDate) lines.push(`    <hashdate>${esc(e.hashDate)}</hashdate>`);
    lines.push('  </hash>');
  }
  lines.push('</hashlist>');
  return lines.join('\n') + '\n';
}

function unesc(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
}

function tag(block: string, name: string): string | undefined {
  const m = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? unesc(m[1].trim()) : undefined;
}

/** Parse an MHL document back into entries. Tolerant of either hash type. */
export function parseMhl(xml: string): MhlEntry[] {
  const entries: MhlEntry[] = [];
  for (const m of xml.matchAll(/<hash>([\s\S]*?)<\/hash>/g)) {
    const block = m[1];
    const relPath = tag(block, 'file');
    if (!relPath) continue;
    const size = tag(block, 'size');
    entries.push({
      relPath,
      sizeBytes: size ? Number(size) : 0,
      xxhash64: tag(block, 'xxhash64be') ?? tag(block, 'xxhash64') ?? tag(block, 'xxhash'),
      md5: tag(block, 'md5'),
      hashDate: tag(block, 'hashdate'),
    });
  }
  return entries;
}

/** Write a sidecar into `folder`, named after the folder + timestamp. Returns its path. */
export async function writeMhl(
  folder: string,
  entries: MhlEntry[],
  meta: Omit<MhlMeta, 'username' | 'hostname'>,
): Promise<string> {
  const full: MhlMeta = {
    ...meta,
    username: safeUser(),
    hostname: os.hostname(),
  };
  const stamp = meta.finishISO.replace(/[:.]/g, '-').replace('T', '_').replace('Z', '');
  const base = path.basename(folder) || 'offload';
  const fileName = `${base}_${stamp}.mhl`;
  const target = path.join(folder, fileName);
  await fs.writeFile(target, buildMhl(entries, full), 'utf8');
  return target;
}

/** Read a sidecar; root is the folder it lives in (MHL paths are relative to it). */
export async function readMhl(mhlPath: string): Promise<{ root: string; entries: MhlEntry[] }> {
  const xml = await fs.readFile(mhlPath, 'utf8');
  return { root: path.dirname(mhlPath), entries: parseMhl(xml) };
}

function safeUser(): string {
  try {
    return os.userInfo().username;
  } catch {
    return '';
  }
}
