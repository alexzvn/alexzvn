// Selbsttest des JM-Suite-Companion-Moduls (kein Framework):
//   node test/selftest.mjs
// Prüft den Zeilenbau gegen die generierten Capabilities und — als Kernpunkt —
// dass JEDE generierte Befehlszeile vom Suite-Protokoll-Parser wieder korrekt
// (ns + verb) gelesen wird (Round-Trip Modul → Tool).
import { CAPABILITIES, KNOWN_ROLES, parseSuiteCommand } from '../generated/protocol.mjs'
import { buildCommandLine, matchesRole, isControlService, pickEndpoint } from '../lib.mjs'

let failed = 0
function eq(actual, expected, msg) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) {
    failed++
    console.error(`FAIL ${msg}\n  erwartet: ${e}\n  bekommen: ${a}`)
  } else {
    console.log(`ok   ${msg}`)
  }
}

// ── Konkrete Zeilen ──────────────────────────────────────────────────────────
const A = (role, id) => CAPABILITIES[role].actions.find((a) => a.id === id)
eq(buildCommandLine('switcher', A('switcher', 'preview'), { scene: 2 }, {}), 'PREVIEW 2', 'switcher PREVIEW 2 (kein NS)')
eq(buildCommandLine('switcher', A('switcher', 'cut'), {}, {}), 'CUT', 'switcher CUT')
eq(buildCommandLine('switcher', A('switcher', 'record'), { mode: 'toggle' }, { recording: '1' }), 'RECORD OFF', 'switcher RECORD toggle@on → OFF')
eq(buildCommandLine('switcher', A('switcher', 'record'), { mode: 'toggle' }, { recording: '0' }), 'RECORD ON', 'switcher RECORD toggle@off → ON')
eq(buildCommandLine('timer', A('timer', 'start'), {}, {}), 'TIMER START', 'timer TIMER START')
eq(buildCommandLine('timer', A('timer', 'add'), { seconds: 30 }, {}), 'TIMER ADD 30', 'timer TIMER ADD 30')
eq(buildCommandLine('player', A('player', 'cue'), { n: 3 }, {}), 'PLAYER CUE 3', 'player PLAYER CUE 3')
eq(buildCommandLine('titler', A('titler', 'template'), { kind: 'banner' }, {}), 'TITLER TEMPLATE banner', 'titler TEMPLATE banner')
eq(buildCommandLine('prompter', A('prompter', 'scroll'), { mode: 'toggle' }, { scrolling: '0' }), 'PROMPTER SCROLL ON', 'prompter SCROLL toggle@off → ON')
eq(buildCommandLine('recorder', A('recorder', 'record'), { mode: 'on' }, {}), 'RECORDER RECORD ON', 'recorder RECORD ON')
eq(buildCommandLine('daw', A('daw', 'rec'), { mode: 'off' }, {}), 'DAW REC OFF', 'daw REC OFF')

// ── matchesRole ──────────────────────────────────────────────────────────────
eq(matchesRole('switcher', ''), true, 'switcher akzeptiert leeres ns (Legacy)')
eq(matchesRole('switcher', 'switcher'), true, 'switcher akzeptiert ns=switcher')
eq(matchesRole('timer', 'timer'), true, 'timer akzeptiert ns=timer')
eq(matchesRole('timer', ''), false, 'timer lehnt leeres ns ab')

// ── mDNS-Auto-Discovery: Endpunkt-Auswahl (Welle 1.6, Stufe 2) ───────────────
// Timer/Presenter annoncieren ZWEI Dienste (eigener + ctl=1-Steuer-Endpunkt);
// das Modul muss den Steuer-Endpunkt wählen. Switcher hat nur seinen ctl-losen
// Alt-Advert (= Steuerserver) → gilt ebenfalls als Steuer-Endpunkt.
const svcs = [
  { role: 'timer', host: '10.0.0.5', port: 7777, name: 'jm-timer', ctl: false }, // Socket.IO
  { role: 'timer', host: '10.0.0.5', port: 8724, name: 'jm-timer-ctl', ctl: true }, // Steuer
  { role: 'switcher', host: '10.0.0.9', port: 8723, name: 'jm-switcher', ctl: false }, // Alt-Advert = Steuer
  { role: 'presenter', host: '10.0.0.7', port: 7330, name: 'jm-presenter', ctl: false }, // nur SSE
]
eq(isControlService({ role: 'timer', ctl: true }), true, 'isControlService: ctl=1 → true')
eq(isControlService({ role: 'timer', ctl: false }), false, 'isControlService: timer ohne ctl → false')
eq(isControlService({ role: 'switcher', ctl: false }), true, 'isControlService: switcher ohne ctl → true (Alt-Advert)')
eq(pickEndpoint('timer', svcs), { host: '10.0.0.5', port: 8724, name: 'jm-timer-ctl' }, 'pickEndpoint timer → ctl=1-Port 8724')
eq(pickEndpoint('switcher', svcs), { host: '10.0.0.9', port: 8723, name: 'jm-switcher' }, 'pickEndpoint switcher → 8723')
eq(pickEndpoint('presenter', svcs), null, 'pickEndpoint presenter → null (nur SSE-Advert, kein Steuer-Endpunkt)')
eq(pickEndpoint('daw', svcs), null, 'pickEndpoint daw → null (nicht im LAN gefunden)')

// ── Round-Trip: jede Action → parsebar mit korrektem ns + verb ───────────────
let rtCount = 0
for (const role of KNOWN_ROLES) {
  for (const a of CAPABILITIES[role].actions) {
    const options = {}
    for (const arg of a.args ?? []) options[arg.id] = arg.default
    const line = buildCommandLine(role, a, options, {})
    const parsed = parseSuiteCommand(line)
    const expectedNs = role // parseSuiteCommand setzt für Switcher-Verben ns='switcher'
    if (!parsed) {
      failed++
      console.error(`FAIL Round-Trip ${role}.${a.id}: "${line}" nicht parsebar`)
    } else if (parsed.ns !== expectedNs || parsed.verb !== a.verb) {
      failed++
      console.error(`FAIL Round-Trip ${role}.${a.id}: "${line}" → ${JSON.stringify(parsed)} (erwartet ns=${expectedNs} verb=${a.verb})`)
    } else {
      rtCount++
    }
  }
}
console.log(`ok   Round-Trip: ${rtCount} Actions bauen gültige, parsebare Protokollzeilen`)

console.log(failed === 0 ? '\nALLE TESTS OK' : `\n${failed} FEHLER`)
process.exit(failed === 0 ? 0 : 1)
