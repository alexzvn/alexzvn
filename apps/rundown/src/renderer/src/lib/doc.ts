// Reine Dokument-Mutationen für den Editor (geben immer ein NEUES Doc zurück;
// der Renderer schickt es per setDoc an den Main, der es persistiert).
import { newId } from '@shared/conductor';
import type { RundownAction, RundownDoc, RundownRow } from '@shared/types';

function withRows(doc: RundownDoc, rows: RundownRow[]): RundownDoc {
  return { ...doc, rows };
}

export function updateRow(doc: RundownDoc, rowId: string, patch: Partial<RundownRow>): RundownDoc {
  return withRows(
    doc,
    doc.rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)),
  );
}

export function addRow(doc: RundownDoc, afterIndex: number): RundownDoc {
  const rows = doc.rows.slice();
  rows.splice(afterIndex + 1, 0, { id: newId('r'), label: 'Neue Zeile', actions: [] });
  return withRows(doc, rows);
}

export function removeRow(doc: RundownDoc, rowId: string): RundownDoc {
  return withRows(
    doc,
    doc.rows.filter((r) => r.id !== rowId),
  );
}

export function moveRow(doc: RundownDoc, from: number, to: number): RundownDoc {
  if (to < 0 || to >= doc.rows.length) return doc;
  const rows = doc.rows.slice();
  const [r] = rows.splice(from, 1);
  rows.splice(to, 0, r);
  return withRows(doc, rows);
}

export function addAction(doc: RundownDoc, rowId: string): RundownDoc {
  const row = doc.rows.find((r) => r.id === rowId);
  if (!row) return doc;
  const action: RundownAction = { id: newId('a'), role: 'timer', verb: 'start', args: [], enabled: true };
  return updateRow(doc, rowId, { actions: [...row.actions, action] });
}

export function updateAction(
  doc: RundownDoc,
  rowId: string,
  actionId: string,
  patch: Partial<RundownAction>,
): RundownDoc {
  const row = doc.rows.find((r) => r.id === rowId);
  if (!row) return doc;
  return updateRow(doc, rowId, {
    actions: row.actions.map((a) => (a.id === actionId ? { ...a, ...patch } : a)),
  });
}

export function removeAction(doc: RundownDoc, rowId: string, actionId: string): RundownDoc {
  const row = doc.rows.find((r) => r.id === rowId);
  if (!row) return doc;
  return updateRow(doc, rowId, { actions: row.actions.filter((a) => a.id !== actionId) });
}
