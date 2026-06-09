/**
 * Baukasten template engine — pure & shared between the renderer (live preview)
 * and the copy job (resolved sub-path). Keeping it here guarantees the preview
 * matches the folder that actually gets created, byte for byte.
 *
 * A pattern is a path with `{token}` placeholders and `/` separators, e.g.
 *   "{kunde}/{YYYY}-{MM}-{DD}_{projekt}/Drehtag-{shootday}"
 */

export type TokenCategory = 'date' | 'project';

export interface TokenDef {
  /** Token name without braces. */
  key: string;
  category: TokenCategory;
  label: string;
  /** Example value shown in the picker. */
  example: string;
}

/** Date/time tokens — resolved from the job timestamp. */
export const DATE_TOKENS: TokenDef[] = [
  { key: 'YYYY', category: 'date', label: 'Jahr (4-stellig)', example: '2026' },
  { key: 'YY', category: 'date', label: 'Jahr (2-stellig)', example: '26' },
  { key: 'MM', category: 'date', label: 'Monat', example: '06' },
  { key: 'DD', category: 'date', label: 'Tag', example: '05' },
  { key: 'HH', category: 'date', label: 'Stunde', example: '14' },
  { key: 'mm', category: 'date', label: 'Minute', example: '37' },
  { key: 'date', category: 'date', label: 'Datum (JJJJ-MM-TT)', example: '2026-06-05' },
];

/** Project/production tokens — resolved from user-entered fields. */
export const PROJECT_TOKENS: TokenDef[] = [
  // PID = offizielle Projektbezeichnung (Jakobs Medien).
  { key: 'pid', category: 'project', label: 'PID', example: 'PID-0042' },
  { key: 'projekt', category: 'project', label: 'Projekt', example: 'Sommerfest' },
  { key: 'kunde', category: 'project', label: 'Kunde', example: 'Musterfirma' },
  { key: 'produktion', category: 'project', label: 'Produktion', example: 'Talk' },
  { key: 'episode', category: 'project', label: 'Episode/Folge', example: '03' },
  { key: 'shootday', category: 'project', label: 'Drehtag', example: '1' },
];

export const ALL_TOKENS: TokenDef[] = [...DATE_TOKENS, ...PROJECT_TOKENS];

/** Field values keyed by project token name. */
export type TemplateFields = Record<string, string>;

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

/** Build the date-token value map for a given moment. */
export function dateValues(date: Date): Record<string, string> {
  const YYYY = String(date.getFullYear());
  const MM = pad(date.getMonth() + 1);
  const DD = pad(date.getDate());
  return {
    YYYY,
    YY: YYYY.slice(-2),
    MM,
    DD,
    HH: pad(date.getHours()),
    mm: pad(date.getMinutes()),
    date: `${YYYY}-${MM}-${DD}`,
  };
}

// Characters illegal in folder names across Windows/macOS/Linux, plus control chars.
const ILLEGAL_CHARS = new RegExp('[<>:"/\\\\|?*\\x00-\\x1f]', 'g');

/**
 * Strip characters illegal in folder names and trim the punctuation Windows
 * rejects (or that looks broken) at segment edges. Keeps inner spaces, dashes
 * and underscores, so an empty token next to a literal "_" or "-" joiner does
 * not leave a stray leading/trailing separator.
 */
export function sanitizeSegment(segment: string): string {
  return segment
    .replace(ILLEGAL_CHARS, '')
    .replace(/\s+/g, ' ')
    .replace(/^[._\s-]+|[._\s-]+$/g, '')
    .trim();
}

/**
 * Resolve a pattern into a relative POSIX-style sub-path. Unknown tokens and
 * empty field values collapse away, and any resulting empty segments are
 * dropped so a blank "{kunde}" never yields a stray separator.
 */
export function resolvePattern(
  pattern: string,
  fields: TemplateFields,
  date: Date,
): string {
  const dates = dateValues(date);
  const resolved = pattern.replace(/\{([a-zA-Z0-9_]+)\}/g, (_m, key: string) => {
    if (key in dates) return dates[key];
    const v = fields[key];
    // Field values must not inject path separators — the pattern owns structure.
    return v == null ? '' : v.replace(/[/\\]/g, '');
  });

  return resolved
    .split('/')
    .map(sanitizeSegment)
    .filter((s) => s.length > 0)
    .join('/');
}

/** Which project tokens a pattern references — drives which fields the UI shows. */
export function usedProjectTokens(pattern: string): TokenDef[] {
  const used = new Set<string>();
  for (const m of pattern.matchAll(/\{([a-zA-Z0-9_]+)\}/g)) used.add(m[1]);
  return PROJECT_TOKENS.filter((t) => used.has(t.key));
}

export interface BuiltinTemplate {
  id: string;
  name: string;
  pattern: string;
  subfolders: string[];
}

/** Shipped starter templates so the tool is useful out of the box. */
export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    id: 'builtin-pid-project',
    name: 'PID + Projekt',
    pattern: '{pid}_{date}_{projekt}',
    subfolders: ['Footage', 'Audio', 'Docs', 'Export'],
  },
  {
    id: 'builtin-date-project',
    name: 'Datum + Projekt',
    pattern: '{date}_{projekt}',
    subfolders: ['Footage', 'Audio', 'Docs', 'Export'],
  },
  {
    id: 'builtin-customer-shoot',
    name: 'Kunde / Drehtag',
    pattern: '{kunde}/{YYYY}-{MM}-{DD}_{projekt}/Drehtag-{shootday}',
    subfolders: ['Footage', 'Audio', 'Stills', 'Docs'],
  },
  {
    id: 'builtin-podcast',
    name: 'Podcast / Folge',
    pattern: '{produktion}/Folge-{episode}_{date}',
    subfolders: ['Audio', 'Video', 'Show-Notes', 'Export'],
  },
  {
    id: 'builtin-flat',
    name: 'Nur Datum (flach)',
    pattern: '{YYYY}/{MM}/{date}',
    subfolders: [],
  },
];
