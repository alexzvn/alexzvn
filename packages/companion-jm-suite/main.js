// Bitfocus-Companion-Modul für die JM Production Suite. EIN Modul für ALLE
// Tools: je Verbindung wählt man die Rolle (Switcher/Timer/Player/Titler/
// Presenter/Prompter/Recorder/DAW); Actions, Feedbacks und Variablen werden
// dynamisch aus der geteilten Capabilities-Tabelle generiert. Gesprochen wird
// das suite-weite Zeilenprotokoll (@jm/suite-control-protocol) über TCP.
//
// Das Protokoll + die Capabilities liegen generiert in ./generated/protocol.mjs
// (aus packages/suite-control-protocol via scripts/sync-companion-protocol.mjs)
// — so bleibt das Modul standalone baubar und driftet nicht von der Suite ab.
import { InstanceBase, runEntrypoint, InstanceStatus, TCPHelper, Regex, combineRgb } from '@companion-module/base'
import { parseSuiteState, createLineBuffer, CAPABILITIES, KNOWN_ROLES } from './generated/protocol.mjs'
import { buildCommandLine, toCompanionOption, matchesRole, isTruthy } from './lib.mjs'

const rgb = (t) => combineRgb(t[0], t[1], t[2])

class JmSuiteInstance extends InstanceBase {
  async init(config) {
    this.config = config
    this.role = config?.role || 'switcher'
    this.state = {}
    const cap = CAPABILITIES[this.role]
    if (cap) {
      this.setActionDefinitions(this.buildActions(cap))
      this.setFeedbackDefinitions(this.buildFeedbacks(cap))
      this.setVariableDefinitions(this.buildVariables(cap))
      this.setPresetDefinitions(this.buildPresets(cap))
    } else {
      this.setActionDefinitions({})
      this.setFeedbackDefinitions({})
      this.setVariableDefinitions([])
    }
    this.connect()
  }

  async destroy() {
    this.disconnect()
  }

  async configUpdated(config) {
    // Rollenwechsel → alles neu aufbauen.
    await this.init(config)
  }

  getConfigFields() {
    const ports = KNOWN_ROLES.map((r) => `${CAPABILITIES[r].label}: ${CAPABILITIES[r].port}`).join(' · ')
    return [
      {
        type: 'dropdown',
        id: 'role',
        label: 'Tool (Rolle)',
        width: 6,
        default: 'switcher',
        choices: KNOWN_ROLES.map((r) => ({ id: r, label: CAPABILITIES[r].label })),
      },
      { type: 'textinput', id: 'host', label: 'IP-Adresse', width: 6, default: '127.0.0.1', regex: Regex.IP },
      { type: 'number', id: 'port', label: 'Port', width: 4, default: 8723, min: 1, max: 65535 },
      { type: 'static-text', id: 'ports', label: 'Standard-Ports', width: 12, value: ports },
    ]
  }

  // ── Definitionen aus der Capabilities-Tabelle ───────────────────────────────

  buildActions(cap) {
    const actions = {}
    for (const a of cap.actions) {
      actions[a.id] = {
        name: a.label,
        options: (a.args ?? []).map(toCompanionOption),
        callback: (ev) => this.send(buildCommandLine(cap.role, a, ev.options, this.state)),
      }
    }
    return actions
  }

  buildFeedbacks(cap) {
    const fb = {}
    for (const f of cap.feedbacks) {
      fb[f.id] = {
        type: 'boolean',
        name: f.label,
        defaultStyle: { bgcolor: rgb(f.bgcolor), color: rgb(f.color) },
        options: f.arg ? [toCompanionOption(f.arg)] : [],
        callback: (feedback) => {
          const v = this.state[f.stateKey]
          if (f.match === 'truthy') return isTruthy(v)
          return Number(v) === Number(feedback.options[f.arg.id])
        },
      }
    }
    return fb
  }

  buildVariables(cap) {
    return cap.variables.map((v) => ({ variableId: v.id, name: v.label }))
  }

  buildPresets(cap) {
    const presets = {}
    for (const a of cap.actions) {
      const options = {}
      for (const arg of a.args ?? []) options[arg.id] = arg.default
      const fb = cap.feedbacks.find((f) => f.id === a.verb || f.stateKey === a.toggleKey)
      presets[a.id] = {
        type: 'button',
        category: cap.label,
        name: a.label,
        style: {
          text: a.label.length > 14 ? a.verb.toUpperCase() : a.label,
          size: '14',
          color: combineRgb(255, 255, 255),
          bgcolor: combineRgb(0, 0, 0),
        },
        steps: [{ down: [{ actionId: a.id, options }], up: [] }],
        feedbacks: fb && !fb.arg ? [{ feedbackId: fb.id, options: {} }] : [],
      }
    }
    return presets
  }

  // ── TCP-Verbindung + STATE ──────────────────────────────────────────────────

  connect() {
    this.disconnect()
    const host = this.config?.host
    const port = Number(this.config?.port) || CAPABILITIES[this.role]?.port || 8723
    if (!host) {
      this.updateStatus(InstanceStatus.BadConfig, 'Keine IP gesetzt')
      return
    }
    this.updateStatus(InstanceStatus.Connecting)
    this.socket = new TCPHelper(host, port)
    const feed = createLineBuffer((line) => {
      const st = parseSuiteState(line)
      if (st && matchesRole(this.role, st.ns)) this.applyState(st.kv)
    })
    this.socket.on('connect', () => {
      this.updateStatus(InstanceStatus.Ok)
      this.send('STATE?')
    })
    this.socket.on('data', (chunk) => feed(chunk.toString('utf8')))
    this.socket.on('error', (err) => {
      this.updateStatus(InstanceStatus.ConnectionFailure, String(err?.message ?? err))
    })
    this.socket.on('end', () => {
      this.updateStatus(InstanceStatus.Disconnected)
    })
  }

  disconnect() {
    if (this.socket) {
      this.socket.destroy()
      this.socket = undefined
    }
  }

  send(line) {
    if (this.socket && this.socket.isConnected) this.socket.send(line + '\n')
  }

  applyState(kv) {
    this.state = kv
    const cap = CAPABILITIES[this.role]
    if (!cap) return
    const values = {}
    for (const v of cap.variables) values[v.id] = kv[v.id] ?? ''
    this.setVariableValues(values)
    this.checkFeedbacks(...cap.feedbacks.map((f) => f.id))
  }
}

runEntrypoint(JmSuiteInstance, [])
