// Gebündelte Patch Notes für Launcher + alle Tools (Issue #13). Bewusst lokal
// gepflegt (offline, von uns kontrolliert) statt aus GitHub-Release-Bodies
// geladen. Bei jedem Release hier die neue Version oben in die passende App
// eintragen — `app` = Release-Tag-Präfix ('launcher' bzw. tool.app, z. B.
// 'player'); Versionen je App NEUESTE ZUERST.

export interface ChangelogEntry {
  version: string;
  /** ISO-Datum (optional, nur zur Anzeige). */
  date?: string;
  notes: string[];
}

export interface AppChangelog {
  /** 'launcher' oder die `app`-Kennung eines Tools (Release-Tag-Präfix). */
  app: string;
  name: string;
  entries: ChangelogEntry[];
}

export const CHANGELOG: AppChangelog[] = [
  {
    app: 'launcher',
    name: 'JM Production Suite',
    entries: [
      {
        version: '0.2.6',
        date: '2026-06-10',
        notes: ['Neues Tool im Werkzeugkasten: JM Transcribe (lokale Untertitel via Whisper).'],
      },
      {
        version: '0.2.5',
        date: '2026-06-10',
        notes: ['Neues Tool im Werkzeugkasten: JM Titler (Live-Bauchbinden → NDI).'],
      },
      {
        version: '0.2.4',
        date: '2026-06-10',
        notes: ['Neues Tool im Werkzeugkasten: JM Prompter (Teleprompter).'],
      },
      {
        version: '0.2.3',
        date: '2026-06-10',
        notes: ['Neues Tool im Werkzeugkasten: JM Stage Display (Bühnen-/Crew-Schirm).'],
      },
      {
        version: '0.2.2',
        date: '2026-06-10',
        notes: ['Patch Notes für JM Copy (Netzwerk-Sync) ergänzt.'],
      },
      {
        version: '0.2.1',
        date: '2026-06-09',
        notes: ['Patch Notes für JM Player, Media Converter und Timer ergänzt.'],
      },
      {
        version: '0.2.0',
        date: '2026-06-09',
        notes: [
          'Tools lassen sich jetzt direkt aus dem Launcher deinstallieren (Windows-Deinstaller bzw. Papierkorb auf macOS).',
          '„Was ist neu?"-Fenster nach Updates und eine Patch-Notes-Übersicht für alle Apps.',
        ],
      },
      {
        version: '0.1.12',
        date: '2026-06-09',
        notes: [
          'Die Launcher-Version wird jetzt im Kopfbereich angezeigt.',
          'Neuer Status-Filter: Alle / Installiert / Update / Nicht installiert.',
        ],
      },
      {
        version: '0.1.11',
        date: '2026-06-09',
        notes: ['Störendes, nicht relevantes Update-Popup beim Start entfernt.'],
      },
    ],
  },
  {
    app: 'player',
    name: 'JM Player',
    entries: [
      {
        version: '0.2.0',
        notes: [
          'Neuer Cue-Show-Modus (QLab-Stil): geordnete Cue-Liste, GO mit Auto-Continue, Pre-Wait und Fades.',
          'Audio-Cues latenzarm; Video-Cues auf separatem Vollbild-Ausgabefenster (2. Bildschirm).',
        ],
      },
      {
        version: '0.1.0',
        notes: [
          'Video-/Audio-Player mit lokaler Bibliothek und Playlists (z. B. Lounge-/Einlassmusik).',
          'Soundboard für Sofort-Cues wie den Theatergong.',
        ],
      },
    ],
  },
  {
    app: 'recorder',
    name: 'JM Audio Recorder',
    entries: [
      {
        version: '0.1.0',
        notes: [
          'Mehrkanal-Audioaufnahme über Dante/ASIO als 32-Bit-Float-WAV.',
          'Pegelmeter sowie Arm / Aufnahme / Stopp.',
        ],
      },
    ],
  },
  {
    app: 'switcher',
    name: 'JM Switcher',
    entries: [
      {
        version: '0.2.0',
        notes: [
          'Audio-Mix, frei skalierbare Ebenen, Chroma-Keying und Companion-Fernsteuerung.',
        ],
      },
      {
        version: '0.1.0',
        notes: [
          'Software-Bildmischer mit Program/Preview, Cut & Dissolve.',
          'Quellen: NDI, Capture-Karten, Bilder und Farbflächen; Aufnahme und RTMP-Streaming.',
        ],
      },
    ],
  },
  {
    app: 'presenter',
    name: 'JM Presenter',
    entries: [
      {
        version: '0.3.1',
        notes: [
          'PDF-/Office-Presenter mit getrennter Referenten- und Publikumsansicht sowie Folien-Editor.',
        ],
      },
    ],
  },
  {
    app: 'copy',
    name: 'JM Copy',
    entries: [
      {
        version: '0.2.0',
        notes: [
          'Neuer Netzwerk-Sync: Quellordner als Einweg-Spiegel auf BackUp-Rechner (Größen-/Zeit-Abgleich, Vorschau, optional Löschen am Ziel).',
          'Manuell oder automatisch (Quelle überwachen / Intervall).',
        ],
      },
      {
        version: '0.1.0',
        notes: [
          'Verifiziertes Offloading mit xxHash64-Prüfung und MHL-Sidecar.',
          'Mehrere Ziele gleichzeitig und Baukasten-Master-Ordner.',
        ],
      },
    ],
  },
  {
    app: 'timer',
    name: 'JM Timer',
    entries: [
      {
        version: '0.1.1',
        notes: ['Beispiel-XLSX-Vorlage im Import zum Herunterladen.'],
      },
      {
        version: '0.1.0',
        notes: ['Countdown-/Ablauf-Timer mit Tabellen-Import (XLSX).'],
      },
    ],
  },
  {
    app: 'sync',
    name: 'JM Sync',
    entries: [
      {
        version: '0.1.0',
        notes: [
          'A/V-Delay-Messung (Lippensynchronität) per Flash + Beep — Software-Ersatz für „Sync-It-Plus".',
        ],
      },
    ],
  },
  {
    app: 'studio-control',
    name: 'JM Studio Control',
    entries: [
      {
        version: '0.1.0',
        notes: ['Studio-Steuerung mit Benutzerverwaltung (Admins legen Nutzer mit Rolle/Passwort an).'],
      },
    ],
  },
  {
    app: 'grafiktool',
    name: 'JM Grafiktool',
    entries: [
      {
        version: '0.1.0',
        notes: ['Ebenenbasierter Grafik-Editor: Bauchbinden, Freistellen, PSD-Import/-Export.'],
      },
    ],
  },
  {
    app: 'media-converter',
    name: 'JM Media Converter',
    entries: [
      {
        version: '0.2.0',
        notes: [
          'Trim mit echter Vorschau: Start/Ende bild-genau setzen.',
          'Warteschlange rechts mit aufklappbaren erledigten Aufträgen; Zielgröße in MB/GB.',
        ],
      },
      {
        version: '0.1.0',
        notes: ['Videokonvertierung (FFmpeg-Codecs) und Office → PDF.'],
      },
    ],
  },
  {
    app: 'ndi-screen-capture',
    name: 'JM NDI Screen Capture',
    entries: [
      {
        version: '0.1.1',
        notes: ['Bildschirm/Fenster + Audio als NDI-Quelle senden (für TriCaster, vMix, OBS).'],
      },
    ],
  },
  {
    app: 'stage-display',
    name: 'JM Stage Display',
    entries: [
      {
        version: '0.1.0',
        notes: [
          'Vollbild-Bühnenschirm auf einem 2. Bildschirm: Countdown vom JM Timer, Uhr, Switcher-Status und Ad-hoc-Nachrichten.',
          'Bündelt mehrere Suite-Tools übers Netzwerk (Timer-Server + Switcher-Companion-Port).',
        ],
      },
    ],
  },
  {
    app: 'prompter',
    name: 'JM Prompter',
    entries: [
      {
        version: '0.1.0',
        notes: [
          'Teleprompter: Skript-Editor + Vollbild-Scroller auf dem Talent-Monitor (2. Bildschirm).',
          'Live regelbar: Tempo, Schriftgröße, Spiegelung (Beamsplitter) und Abschnitts-Marken zum Springen.',
        ],
      },
    ],
  },
  {
    app: 'titler',
    name: 'JM Titler',
    entries: [
      {
        version: '0.1.0',
        notes: [
          'Live-CG als transparente NDI-Quelle: Bauchbinde (Name/Funktion), Banner und Ticker.',
          'Take/Clear mit Einblendung; Stil, Farben, Position frei wählbar. Eingang in TriCaster/vMix/OBS.',
        ],
      },
    ],
  },
  {
    app: 'transcribe',
    name: 'JM Transcribe',
    entries: [
      {
        version: '0.1.0',
        notes: [
          'Lokale, offline Untertitel/Transkripte (SRT/VTT/TXT) aus Audio-/Videodateien via Whisper.',
          'Sprachwahl oder Auto-Erkennung, Übersetzung nach Englisch; Basismodell mitgeliefert, größere nachladbar.',
        ],
      },
    ],
  },
];

const BY_APP = new Map(CHANGELOG.map((c) => [c.app, c]));

export function changelogFor(app: string): AppChangelog | undefined {
  return BY_APP.get(app);
}

/** Eintrag einer bestimmten Version (oder undefined, wenn nicht dokumentiert). */
export function entryFor(app: string, version: string): ChangelogEntry | undefined {
  return BY_APP.get(app)?.entries.find((e) => e.version === version);
}
