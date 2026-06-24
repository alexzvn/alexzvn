// Dünner Renderer-Wrapper um die geteilte CAPABILITIES-Tabelle — dieselbe Quelle,
// die das Companion-Modul nutzt. Treibt die Rollen-/Aktions-Dropdowns im Editor.
import {
  CAPABILITIES,
  KNOWN_ROLES,
  type CapabilityAction,
} from '@jm/suite-control-protocol/capabilities';

export { CAPABILITIES, KNOWN_ROLES };
export type { CapabilityAction };

export function roleLabel(role: string): string {
  return CAPABILITIES[role]?.label ?? role;
}

export function capAction(role: string, verb: string): CapabilityAction | undefined {
  return CAPABILITIES[role]?.actions.find((a) => a.verb === verb);
}

/** Lesbares Etikett einer Aktion, z. B. „JM Presenter · Folie anspringen (3)". */
export function actionLabel(role: string, verb: string, args: (string | number)[]): string {
  const base = `${roleLabel(role)} · ${capAction(role, verb)?.label ?? verb}`;
  return args.length ? `${base} (${args.join(' ')})` : base;
}
