import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { parseClickGroups, partPath, relationshipMap, slideOrder } from './pptx-animations';

/**
 * EXPERIMENTAL: expand a .pptx so each on-click build becomes its own slide.
 *
 * LibreOffice flattens animations when it converts to PDF. To get progressive
 * reveal, we pre-process the deck: every animated slide is duplicated into its
 * build-step sequence (variant 0 = initial content, variant i = initial + first
 * i click-reveals), with the not-yet-revealed shapes removed from each variant.
 * A single LibreOffice conversion of the expanded deck then yields one PDF page
 * per build step, which the presenter walks through naturally.
 *
 * This is text-level OOXML surgery (no XML round-trip): variants are copies of
 * the slide part with whole shape elements deleted by their cNvPr id, plus the
 * matching Content-Types / presentation rels / sldIdLst wiring. Returns the new
 * pptx bytes and the expected page count (for the caller to validate against the
 * actual conversion), or null when there is nothing safe to expand.
 */

const SHAPE_TAGS = ['p:sp', 'p:pic', 'p:graphicFrame', 'p:grpSp', 'p:cxnSp'];
const MAX_BUILDS_PER_SLIDE = 30; // ignore absurd timelines
const MAX_TOTAL_VARIANTS = 300; // overall safety cap → else bail to flat conversion

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Index just past the balanced close of the element opened at `start` (tag). */
function matchClose(xml: string, start: number, tag: string): number {
  const re = new RegExp(`<${escapeRe(tag)}\\b[^>]*?(/?)>|</${escapeRe(tag)}>`, 'g');
  re.lastIndex = start;
  let depth = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    if (m[0].startsWith('</')) {
      depth -= 1;
      if (depth === 0) return re.lastIndex;
    } else if (m[1] === '/') {
      if (depth === 0) return re.lastIndex; // self-closing shape element
    } else {
      depth += 1;
    }
  }
  return -1;
}

/** Remove the shape element whose <p:cNvPr id="id"> is the given id. */
function removeShapeById(xml: string, id: string): string {
  const cnv = new RegExp(`<p:cNvPr\\b[^>]*\\bid="${escapeRe(id)}"[^>]*/?>`).exec(xml);
  if (!cnv) return xml;
  const cnvPos = cnv.index;
  // Nearest preceding shape opening tag is the element that owns this cNvPr.
  let best = -1;
  let bestTag = '';
  for (const tag of SHAPE_TAGS) {
    const openRe = new RegExp(`<${escapeRe(tag)}\\b[^>]*?/?>`, 'g');
    let m: RegExpExecArray | null;
    let last = -1;
    while ((m = openRe.exec(xml)) && m.index < cnvPos) last = m.index;
    if (last > best) {
      best = last;
      bestTag = tag;
    }
  }
  if (best < 0) return xml;
  const end = matchClose(xml, best, bestTag);
  if (end < 0) return xml;
  return xml.slice(0, best) + xml.slice(end);
}

function hideShapes(slideXml: string, ids: Iterable<string>): string {
  let xml = slideXml;
  for (const id of ids) xml = removeShapeById(xml, id);
  // Variants are static snapshots — drop the timing so nothing re-animates.
  return xml.replace(/<p:timing>[\s\S]*?<\/p:timing>/g, '');
}

function maxNumeric(values: Iterable<string>, re: RegExp): number {
  let max = 0;
  for (const v of values) {
    const m = re.exec(v);
    if (m) max = Math.max(max, parseInt(m[1], 10) || 0);
    re.lastIndex = 0;
  }
  return max;
}

export interface ExpandedPptx {
  bytes: Uint8Array;
  pages: number;
}

export function expandPptxBuildSteps(input: Uint8Array): ExpandedPptx | null {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(input);
  } catch {
    return null;
  }
  const presPath = 'ppt/presentation.xml';
  const relsPath = 'ppt/_rels/presentation.xml.rels';
  const ctPath = '[Content_Types].xml';
  if (!files[presPath] || !files[relsPath] || !files[ctPath]) return null;

  const order = slideOrder(files);
  if (!order) return null;

  let rels = strFromU8(files[relsPath]);
  let ct = strFromU8(files[ctPath]);
  const pres = strFromU8(files[presPath]);
  const relMap = relationshipMap(rels);

  // id-allocators seeded past the existing maxima
  let nextSlideNum = maxNumeric(Object.keys(files), /ppt\/slides\/slide(\d+)\.xml$/g) + 1;
  let nextRId = maxNumeric(rels.match(/\bId="rId(\d+)"/g) ?? [], /rId(\d+)/) + 1;
  let nextSldId = Math.max(255, maxNumeric(pres.match(/<p:sldId\b[^>]*\bid="(\d+)"/g) ?? [], /id="(\d+)"/)) + 1;

  // Map sldId r:id → slide part path (for ordering decisions)
  const sldIdEntries = [...pres.matchAll(/<p:sldId\b[^>]*\br:id="([^"]+)"[^>]*\/?>/g)];
  if (sldIdEntries.length === 0) return null;

  const newSldXmlByRid = new Map<string, string>(); // rId → replacement sldIdLst chunk
  const newParts: Record<string, Uint8Array> = {};
  let totalVariants = 0;

  for (const entry of sldIdEntries) {
    const rid = entry[1];
    const target = relMap.get(rid);
    const slidePath = target ? partPath(target) : null;
    const slideBytes = slidePath ? files[slidePath] : undefined;
    if (!slidePath || !slideBytes) {
      newSldXmlByRid.set(rid, entry[0]); // leave untouched
      continue;
    }
    const slideXml = strFromU8(slideBytes);
    const groups = parseClickGroups(slideXml);
    const g = groups.length;
    if (g === 0 || g > MAX_BUILDS_PER_SLIDE) {
      newSldXmlByRid.set(rid, entry[0]);
      continue;
    }
    if (totalVariants + g > MAX_TOTAL_VARIANTS) return null; // too big → flat fallback

    const relsName = slidePath.replace(/slides\/([^/]+)\.xml$/, 'slides/_rels/$1.xml.rels');
    const slideRels = files[relsName] ? files[relsName] : null;

    // Build variants 0..g-1 (the original is the final, fully-revealed variant).
    let prepend = '';
    for (let i = 0; i < g; i += 1) {
      const hide = new Set<string>();
      for (let j = i; j < g; j += 1) for (const id of groups[j]) hide.add(id);
      const variantXml = hideShapes(slideXml, hide);

      const num = nextSlideNum++;
      const partPathNew = `ppt/slides/slide${num}.xml`;
      newParts[partPathNew] = strToU8(variantXml);
      if (slideRels) newParts[`ppt/slides/_rels/slide${num}.xml.rels`] = slideRels;

      ct = ct.replace(
        '</Types>',
        `<Override PartName="/${partPathNew}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>`,
      );
      const ridNew = `rId${nextRId++}`;
      rels = rels.replace(
        '</Relationships>',
        `<Relationship Id="${ridNew}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${num}.xml"/></Relationships>`,
      );
      prepend += `<p:sldId id="${nextSldId++}" r:id="${ridNew}"/>`;
      totalVariants += 1;
    }
    // variants first (initial → more revealed), then the original (full)
    newSldXmlByRid.set(rid, prepend + entry[0]);
  }

  if (totalVariants === 0) return null; // nothing animated → caller uses flat path

  // Rebuild the sldIdLst preserving order, expanding animated slides in place.
  let newPres = pres;
  const lst = pres.match(/<p:sldIdLst>([\s\S]*?)<\/p:sldIdLst>/);
  if (!lst) return null;
  let innerNew = lst[1];
  for (const entry of sldIdEntries) {
    const replacement = newSldXmlByRid.get(entry[1]);
    if (replacement && replacement !== entry[0]) {
      innerNew = innerNew.replace(entry[0], replacement);
    }
  }
  newPres = pres.replace(lst[0], `<p:sldIdLst>${innerNew}</p:sldIdLst>`);

  const out: Record<string, Uint8Array> = { ...files, ...newParts };
  out[presPath] = strToU8(newPres);
  out[relsPath] = strToU8(rels);
  out[ctPath] = strToU8(ct);

  try {
    return { bytes: zipSync(out), pages: order.length + totalVariants };
  } catch {
    return null;
  }
}
