// Dünner Renderer-Wrapper um die geteilte CAPABILITIES-Tabelle (dieselbe Quelle
// wie das Companion-Modul) — liefert Labels/Ports der von Q&A gekoppelten Rollen.
import { CAPABILITIES } from '@jm/suite-control-protocol/capabilities';

export { CAPABILITIES };

/** Rollen, die Q&A ansteuert (Reihenfolge = Anzeige im Verbindungen-Panel). */
export const COUPLED_ROLES = ['timer', 'titler'];

export function roleLabel(role: string): string {
  return CAPABILITIES[role]?.label ?? role;
}

export function rolePort(role: string): number {
  return CAPABILITIES[role]?.port ?? 0;
}
