# JM Production Suite — Release-Proxy (Cloudflare Worker)

Hält **ein** GitHub-Token serverseitig und liefert dem Launcher pro Tool die
neueste Version + eine signierte Download-URL. Dadurch braucht **kein Client ein
GitHub-Token**. Der Proxy selbst ist über einen `PROXY_KEY` geschützt; die
eigentlichen Downloads laufen direkt von GitHubs Storage (nicht über den Worker).

## Was du brauchst
- Cloudflare-Account (Free-Tier reicht).
- GitHub **fine-grained PAT**: Repository nur `alexzvn`, Permission **Contents: Read-only**.
- Einen **Proxy-Key** (zufälliger String), z. B. `openssl rand -hex 24`.

## Deploy (wrangler, empfohlen — ~5 Min)
**Wichtig:** alle Befehle aus DIESEM Ordner (`services/release-proxy/`) ausführen —
sonst findet wrangler die `wrangler.toml` nicht ("Worker name missing").

```bash
cd services/release-proxy   # hier liegen wrangler.toml + worker.js
npm i -g wrangler           # oder: npx wrangler ...
wrangler login              # Browser öffnet sich, mit Cloudflare-Account anmelden

# Erst deployen (legt den Worker an), DANN Secrets — `secret put` braucht einen
# existierenden Worker. Secrets greifen sofort, kein erneutes Deploy nötig.
wrangler deploy             # gibt die URL aus, z. B. https://jm-suite-proxy.<account>.workers.dev
wrangler secret put GITHUB_TOKEN   # PAT einfügen
wrangler secret put PROXY_KEY      # deinen Proxy-Key einfügen
```

Den `REPO`-Wert (Standard `AlexmachtCode/alexzvn`) ggf. in `wrangler.toml` anpassen.
Falls wrangler den Namen partout nicht findet: `--name jm-suite-proxy` an die Befehle anhängen.

### Alternative: Dashboard
Cloudflare → **Workers & Pages** → **Create Worker** → Code aus `worker.js` einfügen →
**Settings → Variables**: `GITHUB_TOKEN` und `PROXY_KEY` als **encrypted secrets**,
`REPO` als Klartext-Variable → **Deploy**.

## Test
```bash
curl -s -H "X-Proxy-Key: <DEIN_KEY>" \
  "https://<dein-worker>.workers.dev/tools/copy/latest?platform=win&arch=x64"
```
Erwartet: `{"version":"0.1.1","assets":{"win":{"url":"https://release-assets.githubusercontent.com/…","size":…,"fileName":"JM.Copy-0.1.1-win-x64.exe"}}}`

Health-Check (ohne Key): `GET https://<dein-worker>.workers.dev/` → `… ok`.

## API
```
GET /tools/:id/latest?platform=<mac|win>&arch=<arm64|x64>
Header: X-Proxy-Key: <PROXY_KEY>
→ 200 { version, assets: { <platform>: { url, size, fileName } } }
```
- `:id` = Tool-ID aus suite.json (`jm-copy`, `jm-sync`, … oder `launcher`).
- Auf macOS bestimmt `arch` das richtige DMG (arm64/x64); auf Windows ist es x64.

## Danach
Schick mir die finale **Worker-URL** — dann backe ich Proxy-URL + Key als Default
in den Launcher (Clients müssen dann nichts mehr eintippen) und release eine neue
Launcher-Version.

> Optional später: statt `PROXY_KEY` Cloudflare Access (Service-Tokens); Caching der
> Release-Liste (~60 s) gegen GitHub-Rate-Limits. Für die Testphase nicht nötig.
