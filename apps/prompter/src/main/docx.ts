import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

// Reiner Text aus .docx/.txt/.md — ohne Fremd-Dependency (Issue #28). Eine .docx
// ist ein ZIP; wir lesen `word/document.xml` über die Central Directory und
// wandeln Absatz-/Umbruch-Tags in Zeilen. Bewusst „best effort" (Text, keine
// Formatierung) — genau das braucht ein Prompter-Skript.

/** Liest eine Skriptdatei als Text. .docx wird entpackt, Rest direkt gelesen. */
export function readScriptFile(filePath: string): string {
  if (/\.docx$/i.test(filePath)) return docxToText(filePath);
  return readFileSync(filePath, 'utf8');
}

export function docxToText(filePath: string): string {
  const buf = readFileSync(filePath);
  const xml = readZipEntry(buf, 'word/document.xml');
  if (!xml) throw new Error('Keine word/document.xml gefunden — kein gültiges .docx?');
  return xmlToText(xml.toString('utf8'));
}

/** Einen Eintrag aus einem ZIP über EOCD + Central Directory lesen. */
function readZipEntry(buf: Buffer, name: string): Buffer | null {
  const EOCD_SIG = 0x06054b50;
  // EOCD vom Ende her suchen (ZIP-Kommentar kann bis 65535 B lang sein).
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;

  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16); // Offset der Central Directory

  const CEN_SIG = 0x02014b50;
  for (let n = 0; n < count; n++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== CEN_SIG) break;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const entryName = buf.toString('utf8', p + 46, p + 46 + nameLen);
    if (entryName === name) return readLocal(buf, localOff, method, compSize);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

function readLocal(buf: Buffer, localOff: number, method: number, compSize: number): Buffer {
  const LOC_SIG = 0x04034b50;
  if (buf.readUInt32LE(localOff) !== LOC_SIG) throw new Error('ZIP: lokaler Header fehlt.');
  // Namens-/Extra-Länge im lokalen Header können von der Central Directory abweichen.
  const nameLen = buf.readUInt16LE(localOff + 26);
  const extraLen = buf.readUInt16LE(localOff + 28);
  const start = localOff + 30 + nameLen + extraLen;
  const data = buf.subarray(start, start + compSize);
  if (method === 0) return Buffer.from(data); // STORED
  if (method === 8) return inflateRawSync(data); // DEFLATE
  throw new Error(`ZIP: Kompressionsmethode ${method} nicht unterstützt.`);
}

/** docx-Body-XML → Text: Absätze/Umbrüche zu Zeilen, Tags entfernen, Entities dekodieren. */
function xmlToText(xml: string): string {
  let s = xml;
  s = s.replace(/<w:tab\b[^>]*\/?>/g, '\t');
  s = s.replace(/<w:br\b[^>]*\/?>/g, '\n');
  s = s.replace(/<\/w:p>/g, '\n'); // Absatzende → Zeilenumbruch
  s = s.replace(/<[^>]+>/g, ''); // alle übrigen Tags entfernen
  s = decodeEntities(s);
  return s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&'); // zuletzt, sonst doppelte Dekodierung
}
