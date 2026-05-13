# JM Studio Control

Central LAN control tool for the Jakobs Medien GmbH broadcast studio — built in the spirit of Bitfocus Companion and Panasonic Media Production Suite.

**MVP scope (Phase 1):**
- Auth with roles (Admin / Operator / Viewer), token sessions, audit log.
- Device inventory + discovery (mDNS, Artnet ArtPoll, Panasonic UDP).
- TriCaster remote control via LiveControl HTTP/Shortcut API.

Audio, PTZ, AjA Kumo routing, Ultimatte, and DMX/Artnet faders are scheduled for later phases.

## Tech stack

Electron 33 (CJS main) · React 18 · TypeScript · Tailwind CSS v4 · Socket.IO · better-sqlite3 · Zustand · bonjour-service · zod.

## Layout

```
src/
├── shared/          # types + zod schemas shared between main and renderer
├── main/
│   ├── server.ts    # http + Socket.IO on :7778
│   ├── db/          # better-sqlite3 schema, audit log
│   ├── auth/        # users, sessions, scrypt password hashing, middleware
│   ├── config/      # JSON-backed device/tricaster inventory
│   ├── discovery/   # mDNS, ArtPoll, Panasonic UDP providers
│   └── drivers/
│       └── tricaster/   # LiveControl HTTP client + connection pool
├── preload/         # contextBridge — `window.jms`
└── renderer/        # React app (Login + AppShell + Setup/Video/Audio/Licht)
```

## Scripts

```bash
npm install            # postinstall rebuilds better-sqlite3 against Electron's ABI
npm run dev            # Electron + Vite hot reload (needs a desktop / xvfb)
npm run build          # bundle main, preload, renderer
npm run typecheck      # node + web tsc projects
npm run mock:tricaster # mock TriCaster on http://127.0.0.1:5951
npm run dist:linux     # AppImage + deb
```

### Running in a headless dev container (GitHub Codespace, etc.)

GitHub Codespaces set `ELECTRON_RUN_AS_NODE=1` and don't expose a display.
Use the prebaked Codespace runner once you've built:

```bash
npm run build
npm run start:codespace      # unsets ELECTRON_RUN_AS_NODE, wraps in xvfb-run
```

Then forward port `7778` and open the URL in your browser. The Electron tray
isn't visible (no display), but the HTTP+Socket.IO server runs normally.

If `better-sqlite3` complains about a `NODE_MODULE_VERSION` mismatch
(happens when npm installs against Node 22 while Electron 33 uses Node 20):

```bash
npm run rebuild:native
```

## First-run admin credentials

On first launch the app creates an `admin` user with a random password.
The password is printed to the console and written to:

```
<userData>/first-run-credentials.txt
```

Log in, then change the password under **Setup → Benutzer**.

## Ports

- `7778` — HTTP API + Socket.IO (server)
- `5174` — Vite dev server (development only)

## Deployment recommendation

Intel N100 / N305 mini-PC, Debian 12 headless, single 2.5 GbE NIC trunked via 802.1Q on VLANs 10 (Video) / 40 (Artnet) / Audio. Run as `systemd` service. Operators install the Electron app on the Regie-Workstation; tablets/laptops open `http://studio-control.local:7778`.
