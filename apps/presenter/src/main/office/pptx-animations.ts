import { strFromU8, unzipSync } from 'fflate';

/**
 * Reads the on-click build animations out of a .pptx (an OOXML zip). LibreOffice
 * flattens every slide to a single static page when it converts to PDF, so the
 * animation timeline is otherwise lost. We parse it ourselves to tell the
 * presenter how many click-builds each slide originally had.
 *
 * We count `nodeType="clickEffect"` nodes inside each slide's <p:timing> — each
 * one is one mouse-click that reveals further content (entrance builds, appearing
 * bullets, …). With-previous/after-previous effects don't add a click and are
 * intentionally not counted. This is a read-only heuristic; it never rewrites the
 * deck, so it cannot break the conversion.
 */

export interface PptxAnimations {
  /** Click-build count per slide, in presentation order (one entry per slide). */
  perSlide: number[];
  /** Slides that have at least one click-build. */
  animatedSlides: number;
  /** Total click-builds across the deck. */
  totalBuilds: number;
}

/** Map of relationship id → target part path, robust to attribute order. */
function relationshipMap(relsXml: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const tag of relsXml.match(/<Relationship\b[^>]*>/g) ?? []) {
    const id = tag.match(/\bId="([^"]+)"/)?.[1];
    const target = tag.match(/\bTarget="([^"]+)"/)?.[1];
    if (id && target) map.set(id, target);
  }
  return map;
}

/** Normalise a presentation-relative rel target to a zip part path under ppt/. */
function partPath(target: string): string {
  if (target.startsWith('/')) return target.slice(1); // absolute "/ppt/slides/.."
  return `ppt/${target.replace(/^\.\//, '')}`; // relative to ppt/
}

/** Slide file paths in presentation (display) order, else null if unreadable. */
function slideOrder(files: Record<string, Uint8Array>): string[] | null {
  const pres = files['ppt/presentation.xml'];
  const rels = files['ppt/_rels/presentation.xml.rels'];
  if (!pres || !rels) return null;
  const relMap = relationshipMap(strFromU8(rels));
  const presXml = strFromU8(pres);
  const lst = presXml.match(/<p:sldIdLst>([\s\S]*?)<\/p:sldIdLst>/);
  if (!lst) return null;
  const order: string[] = [];
  for (const m of lst[1].matchAll(/<p:sldId\b[^>]*\br:id="([^"]+)"[^>]*\/?>/g)) {
    const target = relMap.get(m[1]);
    if (target) order.push(partPath(target));
  }
  return order;
}

/** Count on-click build steps in one slide's XML. */
function clickBuilds(slideXml: string): number {
  const timing = slideXml.match(/<p:timing>[\s\S]*?<\/p:timing>/);
  if (!timing) return 0;
  return (timing[0].match(/nodeType="clickEffect"/g) ?? []).length;
}

/**
 * Analyse a .pptx's animations. Returns null for non-OOXML inputs (.ppt/.odp are
 * not zips) or anything we can't parse — callers treat null as "no info".
 */
export function analyzePptxAnimations(bytes: Uint8Array): PptxAnimations | null {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    return null; // not a zip (e.g. legacy .ppt) or corrupt
  }
  const order = slideOrder(files);
  if (!order) return null;

  const perSlide = order.map((path) => {
    const part = files[path];
    return part ? clickBuilds(strFromU8(part)) : 0;
  });
  return {
    perSlide,
    animatedSlides: perSlide.filter((n) => n > 0).length,
    totalBuilds: perSlide.reduce((a, n) => a + n, 0),
  };
}
