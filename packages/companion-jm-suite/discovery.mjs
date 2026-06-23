// mDNS-Auto-Discovery der Suite-Steuer-Endpunkte für das standalone Companion-
// Modul (Welle 1.6, Stufe 2). Das Modul liegt AUSSERHALB der npm-workspaces und
// darf keine @jm/*-Imports haben — daher spiegelt diese Datei die Browse-Logik
// aus packages/discovery (toDiscovered/discover). `bonjour-service` ist Modul-
// Dependency und wird von companion-module-build mitgebündelt.
//
// Die reine Auswahl-Logik (welcher Dienst ist ein Steuer-Endpunkt, welcher passt
// zur Rolle) liegt bewusst in lib.mjs (ohne bonjour-Import) → dort getestet.
import { Bonjour } from 'bonjour-service'

const SERVICE_TYPE = 'jmps' // → _jmps._tcp

/** Bonjour-Service → normalisierter Eintrag {appId, role, host, port, name, ctl} oder null. */
function normalize(s) {
  const txt = (s && s.txt) || {}
  const appId = typeof txt.appId === 'string' ? txt.appId : ''
  if (!appId) return null
  // IPv4 bevorzugen (für TCP-Clients), sonst Hostname.
  const host = (s.addresses || []).find((a) => a.includes('.')) || s.host
  if (!host) return null
  return {
    appId,
    role: typeof txt.role === 'string' ? txt.role : '',
    host,
    port: s.port,
    name: s.name,
    ctl: String(txt.ctl == null ? '' : txt.ctl) === '1',
  }
}

/**
 * Browst das LAN nach JM-Diensten (_jmps._tcp). `onChange` wird mit der aktuellen
 * Liste gerufen, sobald ein Dienst auf- oder abtaucht. Gibt einen Stopper zurück.
 */
export function browseSuite(onChange) {
  const bonjour = new Bonjour()
  const found = new Map()
  const key = (d) => `${d.appId}@${d.host}:${d.port}`
  const emit = () => onChange([...found.values()])

  const browser = bonjour.find({ type: SERVICE_TYPE }, (s) => {
    const d = normalize(s)
    if (d) {
      found.set(key(d), d)
      emit()
    }
  })
  browser.on('down', (s) => {
    const d = normalize(s)
    if (d && found.delete(key(d))) emit()
  })

  return {
    stop: () => {
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
    },
  }
}
