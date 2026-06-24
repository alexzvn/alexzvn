#!/usr/bin/env node
// LAN-Diagnose für den mDNS-Smoke-Test der JM Production Suite.
//
// Listet live alle JM-Dienste im LAN (_jmps._tcp) mit Rolle, Host:Port und ob es
// ein Steuer-Endpunkt ist (TXT ctl=1, gespiegelt aus @jm/discovery). Damit lässt
// sich der Cross-LAN-Test echt überprüfen: auf BEIDEN Rechnern starten — Rechner A
// startet Tools, Rechner B muss sie hier sehen (gleiches Subnetz, UDP 5353 offen).
//
//   node scripts/mdns-scan.mjs            # läuft bis Strg-C
//   node scripts/mdns-scan.mjs 10         # läuft 10 s und beendet sich (für Skripte/CI-Logs)
//
// Erwartung nach Welle 1.6.2: pro nachgerüstetem Tool ein Eintrag mit CTL=ctl
// (Steuer-Endpunkt, Port 8723–8730) — Timer/Presenter/Prompter zusätzlich ihr
// eigener Dienst OHNE ctl. Der Switcher erscheint nur einmal (ohne ctl).
// bonjour-service ist CJS → Default-Import + Destructuring (named ESM-Import
// scheitert in reinem Node; in @jm/discovery übernimmt das der TS-Bundler).
import bonjourPkg from 'bonjour-service'
const { Bonjour } = bonjourPkg

const SERVICE_TYPE = 'jmps' // → _jmps._tcp
const seconds = Number(process.argv[2]) || 0 // 0 = endlos (bis Strg-C)

/** Bonjour-Service → {appId, role, host, port, name, ctl} oder null. */
function normalize(s) {
  const txt = (s && s.txt) || {}
  const appId = typeof txt.appId === 'string' ? txt.appId : ''
  if (!appId) return null
  const host = (s.addresses || []).find((a) => a.includes('.')) || s.host || '?'
  return {
    appId,
    role: typeof txt.role === 'string' ? txt.role : '',
    host,
    port: s.port,
    name: s.name,
    ctl: String(txt.ctl == null ? '' : txt.ctl) === '1',
  }
}

const found = new Map()
const key = (d) => `${d.appId}@${d.host}:${d.port}`
const bonjour = new Bonjour()

function render() {
  const rows = [...found.values()].sort((a, b) => (a.role + a.port).localeCompare(b.role + b.port))
  if (process.stdout.isTTY) console.clear()
  console.log(`JM-Suite mDNS-Scan (_jmps._tcp) — ${rows.length} Dienst(e)  [${new Date().toLocaleTimeString()}]\n`)
  if (!rows.length) {
    console.log('  (noch nichts gefunden — Tools im selben Subnetz starten, UDP 5353 offen)')
  } else {
    console.log('  ROLE          CTL   HOST:PORT                  NAME')
    console.log('  ' + '-'.repeat(70))
    for (const d of rows) {
      const ctl = d.ctl ? 'ctl' : ' - '
      console.log(`  ${d.role.padEnd(13)} ${ctl.padEnd(5)} ${(d.host + ':' + d.port).padEnd(26)} ${d.name}`)
    }
  }
  if (seconds <= 0) console.log('\n(Strg-C zum Beenden)')
}

const browser = bonjour.find({ type: SERVICE_TYPE }, (s) => {
  const d = normalize(s)
  if (d) {
    found.set(key(d), d)
    render()
  }
})
browser.on('down', (s) => {
  const d = normalize(s)
  if (d && found.delete(key(d))) render()
})

render()

function stop() {
  try {
    browser.stop()
  } catch {
    /* best-effort */
  }
  try {
    bonjour.destroy()
  } catch {
    /* best-effort */
  }
  process.exit(0)
}
process.on('SIGINT', stop)
if (seconds > 0) setTimeout(stop, seconds * 1000)
