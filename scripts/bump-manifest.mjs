#!/usr/bin/env node
// Setzt die latestVersion eines Tools in packages/suite-manifest/suite.json.
//
// Genutzt von der CI (Workflow „Suite Release") nach einem erfolgreichen Build,
// damit die Katalog-Version nicht mehr von Hand gepflegt werden muss — UND lokal
// für die nativ gebauten Tools, die nicht über die CI laufen
// (ndi-screen-capture, switcher, recorder, titler, transcribe):
//
//   node scripts/bump-manifest.mjs <app> <version>
//   node scripts/bump-manifest.mjs switcher 0.2.3
//
// Schreibt valides JSON (2-Space, gleiche Schlüsselreihenfolge). Bei der CI wird
// zusätzlich `changed=1` nach $GITHUB_OUTPUT geschrieben, damit nur bei echter
// Änderung committet wird.
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const [, , app, version] = process.argv;
if (!app || !version) {
  console.error('Usage: node scripts/bump-manifest.mjs <app> <version>');
  process.exit(2);
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(root, 'packages', 'suite-manifest', 'suite.json');

const data = JSON.parse(readFileSync(file, 'utf8'));
const tool = (data.tools ?? []).find((t) => t.app === app);

if (!tool) {
  // z. B. der Launcher wird nicht im Katalog geführt → kein Fehler, nur Hinweis.
  console.log(`Kein Tool mit app="${app}" in suite.json — kein Bump.`);
  process.exit(0);
}

if (tool.latestVersion === version) {
  console.log(`${app}: latestVersion ist bereits ${version} — nichts zu tun.`);
  process.exit(0);
}

const prev = tool.latestVersion;
tool.latestVersion = version;
data.updatedAt = new Date().toISOString();
writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
console.log(`${app}: latestVersion ${prev} → ${version}`);

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, 'changed=1\n');
}
