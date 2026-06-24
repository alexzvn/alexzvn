// ─────────────────────────────────────────────────────────────────────────────
// @jm/companion-protocol — DÜNNER RE-EXPORT (Bestandsschutz).
//
// Das Switcher-Steuerprotokoll ist im suite-weiten Paket @jm/suite-control-
// protocol aufgegangen. Diese Datei re-exportiert dessen pure Schicht, damit
// bestehende Importe (`import { … } from '@jm/companion-protocol'`) unverändert
// weiterlaufen. Neuer Code sollte direkt @jm/suite-control-protocol verwenden:
//   - pure Parser/Typen:           @jm/suite-control-protocol
//   - TCP-Server (Main-Prozess):   @jm/suite-control-protocol/server
//   - TCP-Client (Main-Prozess):   @jm/suite-control-protocol/client
//   - Companion-Capabilities:      @jm/suite-control-protocol/capabilities
//
// @deprecated Bitte @jm/suite-control-protocol importieren.
// ─────────────────────────────────────────────────────────────────────────────

export * from '@jm/suite-control-protocol';
