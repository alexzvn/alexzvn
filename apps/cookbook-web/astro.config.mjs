import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// JM Kochbuch — interne Doku-Website. Inhalte werden aus cookbook.json generiert
// (scripts/sync-content.mjs, läuft vor dev/build). Single-Language Deutsch.
export default defineConfig({
  // Interne URL — bei Bedarf an den tatsächlichen Hosting-Ort anpassen.
  site: 'https://kochbuch.jakobsmedien.intern',
  integrations: [
    starlight({
      title: 'JM Kochbuch',
      description: 'Internes Nachschlagewerk: Best Practices & Manuals der Jakobs Medien GmbH.',
      defaultLocale: 'root',
      locales: { root: { label: 'Deutsch', lang: 'de' } },
      customCss: ['./src/styles/jm.css'],
      pagination: false,
      sidebar: [
        { label: 'Veranstaltungsformate', items: [{ autogenerate: { directory: 'veranstaltungsformate' } }] },
        { label: 'Technik-Setups', items: [{ autogenerate: { directory: 'technik-setups' } }] },
        { label: 'Kunden-/Location-Setups', items: [{ autogenerate: { directory: 'kunden-location-setups' } }] },
        { label: 'Tool-Manuals', items: [{ autogenerate: { directory: 'tool-manuals' } }] },
      ],
    }),
  ],
});
