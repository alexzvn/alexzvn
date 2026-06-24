// System-Prompt für den KI-Authoring-Flow (Pfad B). Die KI bekommt die Roh-Infos
// eines Media Operators und liefert ein Recipe-JSON, das exakt dem Schema folgt.
// Der Proxy validiert das JSON (recipe-core.validateRecipe) und rendert es zur
// `.md` (recipe-core.renderRecipeMarkdown). Pur, keine Laufzeit-Abhängigkeiten.

import { CATEGORIES, DIFFICULTIES, OWNERS } from './recipe-core.mjs';

/** Kompaktes Beispiel (Few-Shot), zeigt Form + ehrliche „Lücke"-Markierung. */
const EXAMPLE = {
  id: 'beispiel-webinar',
  title: 'Webinar (online)',
  category: 'Veranstaltungsformate',
  difficulty: 'einfach',
  setupTimeMin: 60,
  teamSize: '1',
  tags: ['webinar', 'online', 'streaming'],
  relatedTools: ['jm-switcher', 'jm-presenter'],
  prerequisites: ['Stabile Upload-Leitung', 'Webinar-Plattform/Zugang'],
  equipmentOwner: 'jm',
  crewRoles: ['Media Operator'],
  lastReviewed: '2026-06-24',
  owner: 'tech@jakobsmedien.com',
  summary: 'Reines Online-Webinar mit Bildschirm-/Folienanteil und Moderation.',
  blocks: {
    ingredients: [{ title: 'Voraussetzungen', items: ['Webinar-Plattform', 'Headset', 'Folien (JM Presenter)'] }],
    steps: {
      vor: ['Plattform und Zugänge testen', 'Folien prüfen', 'Soundcheck'],
      waehrend: ['Moderation, Folien teilen', 'Chat/Fragen im Blick'],
      nach: ['Aufzeichnung bereitstellen'],
    },
    tips: ['Vorab einen Technik-Durchlauf mit allen Vortragenden machen.'],
    troubleshooting: [{ risk: 'Ton/Bild beim Vortragenden fehlt', remedy: '(bitte ergänzen: plattformspezifische Schritte)' }],
    checklists: [{ title: 'Vor Live', items: ['Plattform getestet', 'Folien geladen', 'Ton geprüft'] }],
  },
};

/**
 * Baut den System-Prompt.
 * @param {{ toolIds?: string[] }} opts - erlaubte relatedTools-IDs (aus suite.json)
 */
export function buildAuthoringPrompt({ toolIds = [] } = {}) {
  return [
    'Du hilfst Media Operators der Jakobs Medien GmbH, ein Rezept fürs interne „JM Kochbuch" zu erstellen.',
    'Aus den Roh-Notizen der Person formst du EIN gültiges Rezept-Objekt — auf Deutsch, in praktischer, ehrlicher Flughöhe.',
    '',
    'Antworte AUSSCHLIESSLICH mit einem einzigen JSON-Objekt (keine Erklärung, kein Markdown-Codeblock).',
    '',
    'Schema des JSON-Objekts:',
    '- id: kebab-case (nur a-z, 0-9, -), abgeleitet aus dem Titel',
    '- title, summary: kurze, sachliche Texte',
    `- category: einer von ${JSON.stringify(CATEGORIES)}`,
    `- difficulty: einer von ${JSON.stringify(DIFFICULTIES)}`,
    `- equipmentOwner: einer von ${JSON.stringify(OWNERS)}`,
    '- setupTimeMin: Zahl (Minuten); teamSize: Text (z. B. "1" oder "2-3")',
    '- tags, prerequisites, crewRoles: Listen von Texten',
    `- relatedTools: Liste von Tool-IDs, NUR aus dieser Liste: ${JSON.stringify(toolIds)}`,
    '- lastReviewed: heutiges Datum als "YYYY-MM-DD"; owner: "tech@jakobsmedien.com" (sofern nicht anders genannt)',
    '- blocks.ingredients: Liste von { title, items[] } (z. B. Voraussetzungen, Equipment, Rollen)',
    '- blocks.steps: { vor[], waehrend[], nach[] } (Vorbereitung / Während / Nachbereitung)',
    '- blocks.tips: Liste (optional)',
    '- blocks.troubleshooting: Liste von { risk, remedy }',
    '- blocks.checklists: Liste von { title, items[] }',
    '',
    'WICHTIGE REGELN:',
    '- Erfinde KEINE Fakten. Wenn eine Information fehlt, schreibe an die passende Stelle einen klar markierten Platzhalter wie "(bitte ergänzen: …)" statt zu raten.',
    '- Verwende ausschließlich die erlaubten Werte für category/difficulty/equipmentOwner.',
    '- relatedTools nur aus der erlaubten Liste; passt keins, lass die Liste leer.',
    '- Keine personenbezogenen oder vertraulichen Kundendaten ins Rezept übernehmen.',
    '',
    'Beispiel für Form und Umgang mit Lücken:',
    JSON.stringify(EXAMPLE, null, 2),
  ].join('\n');
}
