// Bitfocus-Companion-Modul für den JM Switcher. Spricht das geteilte
// Zeilenprotokoll (@jm/companion-protocol) über TCP. Im Companion: Host = IP des
// Switcher-Rechners, Port = der im Switcher-Einstellungen-Tab konfigurierte Port.
import {
  InstanceBase,
  runEntrypoint,
  InstanceStatus,
  TCPHelper,
  Regex,
  combineRgb,
} from '@companion-module/base'
import { DEFAULT_CONTROL_PORT, createLineBuffer, parseState } from '@jm/companion-protocol'

const RED = combineRgb(200, 30, 30)
const GREEN = combineRgb(30, 160, 60)
const YELLOW = combineRgb(251, 231, 59)
const BLACK = combineRgb(0, 0, 0)
const WHITE = combineRgb(255, 255, 255)

function sceneOption() {
  return { type: 'number', id: 'scene', label: 'Szene (Nr.)', default: 1, min: 1, max: 64 }
}

function modeOption() {
  return {
    type: 'dropdown',
    id: 'mode',
    label: 'Modus',
    default: 'toggle',
    choices: [
      { id: 'toggle', label: 'Umschalten' },
      { id: 'on', label: 'Start' },
      { id: 'off', label: 'Stopp' },
    ],
  }
}

function modeToArg(mode, current) {
  if (mode === 'on') return 'START'
  if (mode === 'off') return 'STOP'
  return current ? 'STOP' : 'START'
}

class JmSwitcherInstance extends InstanceBase {
  async init(config) {
    this.config = config
    this.state = { program: 0, preview: 0, recording: false, streaming: false, scenes: 0 }
    this.setActionDefinitions(this.buildActions())
    this.setFeedbackDefinitions(this.buildFeedbacks())
    this.setVariableDefinitions(this.buildVariables())
    this.setPresetDefinitions(this.buildPresets())
    this.applyState(this.state)
    this.connect()
  }

  async destroy() {
    this.disconnect()
  }

  async configUpdated(config) {
    this.config = config
    this.connect()
  }

  getConfigFields() {
    return [
      {
        type: 'textinput',
        id: 'host',
        label: 'Switcher-IP',
        width: 6,
        default: '127.0.0.1',
        regex: Regex.IP,
      },
      {
        type: 'number',
        id: 'port',
        label: 'Port',
        width: 4,
        default: DEFAULT_CONTROL_PORT,
        min: 1,
        max: 65535,
      },
    ]
  }

  connect() {
    this.disconnect()
    const host = this.config?.host
    const port = Number(this.config?.port) || DEFAULT_CONTROL_PORT
    if (!host) {
      this.updateStatus(InstanceStatus.BadConfig, 'Keine IP gesetzt')
      return
    }
    this.updateStatus(InstanceStatus.Connecting)
    this.socket = new TCPHelper(host, port)
    const feed = createLineBuffer((line) => {
      const st = parseState(line)
      if (st) this.applyState(st)
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
    if (this.socket && this.socket.isConnected) {
      this.socket.send(line + '\n')
    }
  }

  applyState(st) {
    this.state = st
    this.setVariableValues({
      program: st.program,
      preview: st.preview,
      recording: st.recording ? 'an' : 'aus',
      streaming: st.streaming ? 'an' : 'aus',
      scenes: st.scenes,
    })
    this.checkFeedbacks('program_scene', 'preview_scene', 'recording', 'streaming')
  }

  buildActions() {
    return {
      preview: {
        name: 'Preview-Szene wählen',
        options: [sceneOption()],
        callback: (a) => this.send(`PREVIEW ${a.options.scene}`),
      },
      program: {
        name: 'Program-Szene (harter Schnitt)',
        options: [sceneOption()],
        callback: (a) => this.send(`PROGRAM ${a.options.scene}`),
      },
      cut: { name: 'Cut (Program = Preview)', options: [], callback: () => this.send('CUT') },
      auto: {
        name: 'Auto (Dissolve)',
        options: [{ type: 'number', id: 'ms', label: 'Dauer ms (0 = Standard)', default: 0, min: 0, max: 10000 }],
        callback: (a) => this.send(a.options.ms ? `AUTO ${a.options.ms}` : 'AUTO'),
      },
      record: {
        name: 'Aufnahme',
        options: [modeOption()],
        callback: (a) => this.send(`RECORD ${modeToArg(a.options.mode, this.state.recording)}`),
      },
      stream: {
        name: 'Stream (RTMP)',
        options: [modeOption()],
        callback: (a) => this.send(`STREAM ${modeToArg(a.options.mode, this.state.streaming)}`),
      },
    }
  }

  buildFeedbacks() {
    return {
      program_scene: {
        type: 'boolean',
        name: 'Szene ist auf Program',
        defaultStyle: { bgcolor: RED, color: WHITE },
        options: [sceneOption()],
        callback: (fb) => this.state.program === Number(fb.options.scene),
      },
      preview_scene: {
        type: 'boolean',
        name: 'Szene ist auf Preview',
        defaultStyle: { bgcolor: GREEN, color: WHITE },
        options: [sceneOption()],
        callback: (fb) => this.state.preview === Number(fb.options.scene),
      },
      recording: {
        type: 'boolean',
        name: 'Aufnahme läuft',
        defaultStyle: { bgcolor: RED, color: WHITE },
        options: [],
        callback: () => this.state.recording,
      },
      streaming: {
        type: 'boolean',
        name: 'Stream läuft',
        defaultStyle: { bgcolor: YELLOW, color: BLACK },
        options: [],
        callback: () => this.state.streaming,
      },
    }
  }

  buildVariables() {
    return [
      { variableId: 'program', name: 'Program-Szene (Nr.)' },
      { variableId: 'preview', name: 'Preview-Szene (Nr.)' },
      { variableId: 'recording', name: 'Aufnahme (an/aus)' },
      { variableId: 'streaming', name: 'Stream (an/aus)' },
      { variableId: 'scenes', name: 'Anzahl Szenen' },
    ]
  }

  buildPresets() {
    const presets = {
      cut: {
        type: 'button',
        category: 'Transport',
        name: 'Cut',
        style: { text: 'CUT', size: '18', color: WHITE, bgcolor: BLACK },
        steps: [{ down: [{ actionId: 'cut', options: {} }], up: [] }],
        feedbacks: [],
      },
      auto: {
        type: 'button',
        category: 'Transport',
        name: 'Auto',
        style: { text: 'AUTO', size: '18', color: BLACK, bgcolor: YELLOW },
        steps: [{ down: [{ actionId: 'auto', options: { ms: 0 } }], up: [] }],
        feedbacks: [],
      },
      record: {
        type: 'button',
        category: 'Transport',
        name: 'Aufnahme',
        style: { text: 'REC', size: '18', color: WHITE, bgcolor: BLACK },
        steps: [{ down: [{ actionId: 'record', options: { mode: 'toggle' } }], up: [] }],
        feedbacks: [{ feedbackId: 'recording', options: {} }],
      },
      stream: {
        type: 'button',
        category: 'Transport',
        name: 'Stream',
        style: { text: 'STREAM', size: '14', color: WHITE, bgcolor: BLACK },
        steps: [{ down: [{ actionId: 'stream', options: { mode: 'toggle' } }], up: [] }],
        feedbacks: [{ feedbackId: 'streaming', options: {} }],
      },
    }
    for (let n = 1; n <= 4; n++) {
      presets[`pvw${n}`] = {
        type: 'button',
        category: 'Preview',
        name: `Preview Szene ${n}`,
        style: { text: `PVW ${n}`, size: '14', color: WHITE, bgcolor: BLACK },
        steps: [{ down: [{ actionId: 'preview', options: { scene: n } }], up: [] }],
        feedbacks: [{ feedbackId: 'preview_scene', options: { scene: n } }],
      }
      presets[`pgm${n}`] = {
        type: 'button',
        category: 'Program',
        name: `Program Szene ${n}`,
        style: { text: `PGM ${n}`, size: '14', color: WHITE, bgcolor: BLACK },
        steps: [{ down: [{ actionId: 'program', options: { scene: n } }], up: [] }],
        feedbacks: [{ feedbackId: 'program_scene', options: { scene: n } }],
      }
    }
    return presets
  }
}

runEntrypoint(JmSwitcherInstance, [])
