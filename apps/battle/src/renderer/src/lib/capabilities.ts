// Dünner Renderer-Wrapper um die geteilte CAPABILITIES-Tabelle — Labels/Ports der
// von Battle gekoppelten Rolle (titler).
import { CAPABILITIES } from '@jm/suite-control-protocol/capabilities';

export { CAPABILITIES };

export const COUPLED_ROLES = ['titler'];

export function roleLabel(role: string): string {
  return CAPABILITIES[role]?.label ?? role;
}
