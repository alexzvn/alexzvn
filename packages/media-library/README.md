# @jm/media-library

Geteilte Medienbibliothek auf Basis von **better-sqlite3**. Liefert Schema +
Verbindung für **Playlists**, **Soundboard-Cues** und **Tags** — gebaut für den
**JM Player** (Lounge-/Einlass-Musik, Theatergong-Cues), wiederverwendbar für
weitere Tools, die eine lokale Medien-DB brauchen.

Modelliert nach `apps/studio-control/src/main/db/sqlite.ts` (Muster B:
better-sqlite3 native, extern gehalten + asarUnpack + electron-rebuild), aber
parametrisiert und mit eigenem Media-Schema.

## API

```ts
import { openLibrary, getLibrary, closeLibrary } from '@jm/media-library';
import type { MediaItemRow, PlaylistRow, CueRow } from '@jm/media-library';

const db = openLibrary();                 // <userData>/data/library.sqlite, WAL, FK, migriert
const items = db.prepare('SELECT * FROM media_items ORDER BY added_at DESC').all() as MediaItemRow[];
```

`openLibrary({ fileName?, dir? })` ist idempotent und führt das Schema-Migrate
beim Öffnen aus. Tabellen: `media_items`, `playlists`, `playlist_items`,
`cues` (Soundboard-Pads), `tags`, `media_tags`. Schema-Version steht in
`PRAGMA user_version` (`SCHEMA_VERSION`).

## Einbau im konsumierenden Tool (Muster B — native)

better-sqlite3 ist ein **natives** Modul. Es darf **nicht** in den App-Bundle
gerollt werden, sondern bleibt extern + wird für Electron neu gebaut. Im neuen
Tool (z. B. JM Player) daher:

1. **package.json** — `better-sqlite3` als *eigene* Dependency listen (zusätzlich
   zu `@jm/media-library`), plus Rebuild-Hooks:
   ```jsonc
   "dependencies": { "@jm/media-library": "*", "better-sqlite3": "^11.3.0" },
   "devDependencies": { "@electron/rebuild": "^4.0.4", "@types/better-sqlite3": "^7.6.11" },
   "scripts": {
     "rebuild:native": "electron-rebuild --only better-sqlite3",
     "postinstall": "electron-rebuild --only better-sqlite3 || true"
   }
   ```
2. **electron.vite.config.ts** — `@jm/media-library` *als Quelle bündeln*
   (in `internalPackages` / `externalizeDepsPlugin({ exclude })`), better-sqlite3
   bleibt **extern** (nicht in die exclude-Liste):
   ```ts
   const internalPackages = ['@jm/electron-kit', '@jm/media-library'];
   plugins: [externalizeDepsPlugin({ exclude: internalPackages })]
   ```
3. **electron-builder.yml** — den nativen Treiber aus der asar holen:
   ```yaml
   asarUnpack:
     - "**/node_modules/better-sqlite3/**"
   ```
