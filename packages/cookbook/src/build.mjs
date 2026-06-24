// Kochbuch-Compiler: liest die Markdown-Quellen unter content/**, validiert das
// Frontmatter, parst die festen Template-Blöcke in strukturierte Daten und
// schreibt cookbook.json (gebündelte/Proxy-Quelle, analog suite.json).
//
//   node src/build.mjs           # cookbook.json schreiben
//   node src/build.mjs --check   # nur prüfen, ob cookbook.json frisch ist (CI)
//
// Bewusst ohne markdown-it: Blöcke sind strukturierte Daten (keine HTML-Strings),
// deshalb genügt ein zeilenbasierter Parser. gray-matter parst das YAML-Frontmatter.

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(HERE, '..'); // packages/cookbook
const CONTENT_DIR = join(PKG_ROOT, 'content');
const OUT_FILE = join(PKG_ROOT, 'cookbook.json');
const SCHEMA_VERSION = 1;

const CATEGORIES = ['Veranstaltungsformate', 'Technik-Setups', 'Kunden-/Location-Setups', 'Tool-Manuals'];
const DIFFICULTIES = ['einfach', 'mittel', 'anspruchsvoll', 'profi'];
const OWNERS = ['kunde-haus', 'jm', 'gemischt'];

const CHECK = process.argv.includes('--check');
const errors = [];
const warnings = [];

/** Alle .md-Dateien unter content/ rekursiv, sortiert (deterministisch). */
function findMarkdown(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findMarkdown(full));
    else if (entry.name.endsWith('.md')) out.push(full);
  }
  return out.sort();
}

/** YAML-Datum (js-yaml liefert ein Date) → ISO-Datumsstring YYYY-MM-DD. */
function toDateStr(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

const listItem = (line) => {
  // "- text", "* text", "- [ ] text", "- [x] text"
  const m = line.match(/^\s*[-*]\s+(?:\[[ xX]\]\s+)?(.*\S)\s*$/);
  return m ? m[1] : null;
};

const tableCells = (line) => {
  const t = line.trim();
  if (!t.startsWith('|')) return null;
  return t.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
};

const isSeparatorRow = (cells) => cells.every((c) => /^:?-{2,}:?$/.test(c));

/** Body in Abschnitte (## ) mit Unterabschnitten (### ), Listen und Tabellen zerlegen. */
function parseBody(body) {
  const sections = [];
  let section = null;
  let sub = null;
  for (const raw of body.split(/\r?\n/)) {
    const t = raw.trim();
    if (t.startsWith('## ')) {
      section = { h2: t.slice(3).trim(), items: [], rows: [], subs: [] };
      sub = null;
      sections.push(section);
      continue;
    }
    if (t.startsWith('### ')) {
      sub = { h3: t.slice(4).trim(), items: [], rows: [] };
      if (section) section.subs.push(sub);
      continue;
    }
    if (!section) continue;
    const target = sub ?? section;
    const li = listItem(raw);
    if (li !== null) {
      target.items.push(li);
      continue;
    }
    const cells = tableCells(raw);
    if (cells && !isSeparatorRow(cells)) target.rows.push(cells);
  }
  return sections;
}

/** Abschnitte → strukturierte Blöcke (das Rezept-Template). */
function buildBlocks(sections, id) {
  const find = (pred) => sections.find((s) => pred(s.h2.toLowerCase()));
  const ing = find((h) => h.includes('zutat'));
  const steps = find((h) => h.includes('schritt'));
  const tipsSec = find((h) => h.includes('tipp'));
  const trouble = find((h) => h.includes('panne'));
  const check = find((h) => h.includes('checklist'));

  const phase = (sec, pred) => sec?.subs.find((x) => pred(x.h3.toLowerCase()))?.items ?? [];

  const ingredients = ing ? ing.subs.map((s) => ({ title: s.h3, items: s.items })) : [];
  const blocks = {
    ingredients,
    steps: {
      vor: phase(steps, (h) => h.includes('vorbereit')),
      waehrend: phase(steps, (h) => h.includes('während') || h.includes('waehrend') || h.includes('live')),
      nach: phase(steps, (h) => h.includes('nachbereit')),
    },
    // rows[0] ist die Tabellen-Kopfzeile (Risiko | Gegenmaßnahme), die Trennzeile
    // wurde bereits in parseBody gefiltert → ab der zweiten Zeile sind es Daten.
    troubleshooting: trouble ? trouble.rows.slice(1).map((r) => ({ risk: r[0], remedy: r[1] ?? '' })) : [],
    checklists: check ? check.subs.map((s) => ({ title: s.h3, items: s.items })) : [],
  };
  const tips = tipsSec ? tipsSec.items : [];
  if (tips.length) blocks.tips = tips;

  if (ingredients.length === 0) warnings.push(`${id}: keine Zutaten-Gruppen gefunden`);
  if (!blocks.steps.vor.length && !blocks.steps.waehrend.length && !blocks.steps.nach.length) {
    warnings.push(`${id}: keine Schritte gefunden`);
  }
  return blocks;
}

function validateFrontmatter(data, id, fileId) {
  const req = ['id', 'title', 'category', 'difficulty', 'setupTimeMin', 'teamSize', 'equipmentOwner', 'lastReviewed', 'owner', 'summary'];
  for (const k of req) {
    if (data[k] === undefined || data[k] === null || data[k] === '') errors.push(`${id}: Pflichtfeld fehlt: ${k}`);
  }
  if (data.id !== fileId) errors.push(`${id}: id "${data.id}" != Dateiname "${fileId}"`);
  if (!CATEGORIES.includes(data.category)) errors.push(`${id}: ungültige category: ${data.category}`);
  if (!DIFFICULTIES.includes(data.difficulty)) errors.push(`${id}: ungültige difficulty: ${data.difficulty}`);
  if (!OWNERS.includes(data.equipmentOwner)) errors.push(`${id}: ungültiger equipmentOwner: ${data.equipmentOwner}`);
  if (typeof data.setupTimeMin !== 'number') errors.push(`${id}: setupTimeMin muss eine Zahl sein`);
}

function toRecipe(data, blocks) {
  const recipe = {
    id: data.id,
    title: data.title,
    category: data.category,
    difficulty: data.difficulty,
    setupTimeMin: data.setupTimeMin,
    teamSize: String(data.teamSize),
    tags: data.tags ?? [],
    relatedTools: data.relatedTools ?? [],
    prerequisites: data.prerequisites ?? [],
    equipmentOwner: data.equipmentOwner,
    crewRoles: data.crewRoles ?? [],
    lastReviewed: toDateStr(data.lastReviewed),
    owner: data.owner,
    summary: data.summary,
    blocks,
  };
  if (data.location) recipe.location = data.location;
  return recipe;
}

// --- optionale Soft-Validierung der Tool-Deep-Links gegen suite.json ---
let knownToolIds = null;
try {
  const suite = JSON.parse(readFileSync(join(PKG_ROOT, '..', 'suite-manifest', 'suite.json'), 'utf8'));
  knownToolIds = new Set(suite.tools.map((t) => t.id));
} catch {
  // suite-manifest nicht lesbar → Deep-Link-Prüfung überspringen
}

const files = findMarkdown(CONTENT_DIR);
if (files.length === 0) {
  console.error(`Keine Rezepte in ${CONTENT_DIR} gefunden.`);
  process.exit(1);
}

const recipes = [];
for (const file of files) {
  const fileId = basename(file, '.md');
  const { data, content } = matter(readFileSync(file, 'utf8'));
  validateFrontmatter(data, fileId, fileId);
  if (knownToolIds && Array.isArray(data.relatedTools)) {
    for (const tid of data.relatedTools) {
      if (!knownToolIds.has(tid)) warnings.push(`${fileId}: relatedTools verweist auf unbekanntes Tool "${tid}"`);
    }
  }
  recipes.push(toRecipe(data, buildBlocks(parseBody(content), fileId)));
}

if (errors.length) {
  console.error('Kochbuch-Build fehlgeschlagen:');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}

// deterministische Reihenfolge: nach Kategorie-Reihenfolge, dann Titel
recipes.sort((a, b) => {
  const ci = CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category);
  return ci !== 0 ? ci : a.title.localeCompare(b.title, 'de');
});

// updatedAt deterministisch aus dem jüngsten lastReviewed (sonst wäre --check nie frisch)
const updatedAt = `${recipes.map((r) => r.lastReviewed).sort().at(-1)}T00:00:00.000Z`;
const cookbook = { schemaVersion: SCHEMA_VERSION, updatedAt, recipes };
const json = JSON.stringify(cookbook, null, 2) + '\n';

for (const w of warnings) console.warn('  ! ' + w);

if (CHECK) {
  const current = existsSync(OUT_FILE) ? readFileSync(OUT_FILE, 'utf8') : '';
  if (current !== json) {
    console.error('cookbook.json ist veraltet — bitte `npm run cookbook:build` ausführen und committen.');
    process.exit(1);
  }
  console.log(`cookbook.json ist frisch (${recipes.length} Rezepte).`);
} else {
  writeFileSync(OUT_FILE, json);
  console.log(`cookbook.json geschrieben: ${recipes.length} Rezepte.`);
}
