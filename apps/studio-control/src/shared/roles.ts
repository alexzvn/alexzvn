export type Role = 'admin' | 'operator' | 'viewer';

export const ROLES: Role[] = ['admin', 'operator', 'viewer'];

const RANK: Record<Role, number> = { admin: 3, operator: 2, viewer: 1 };

export function hasMinRole(role: Role, min: Role): boolean {
  return RANK[role] >= RANK[min];
}

export type Action =
  | 'inventory:read'
  | 'inventory:write'
  | 'discovery:run'
  | 'tricaster:read'
  | 'tricaster:exec'
  | 'ptz:read'
  | 'ptz:exec'
  | 'lighting:read'
  | 'lighting:exec'
  | 'audio:read'
  | 'audio:exec'
  | 'atem:read'
  | 'atem:exec'
  | 'obs:read'
  | 'obs:exec'
  | 'users:read'
  | 'users:write'
  | 'audit:read';

const ACTION_MIN: Record<Action, Role> = {
  'inventory:read': 'viewer',
  'inventory:write': 'operator',
  'discovery:run': 'operator',
  'tricaster:read': 'viewer',
  'tricaster:exec': 'operator',
  'ptz:read': 'viewer',
  'ptz:exec': 'operator',
  'lighting:read': 'viewer',
  'lighting:exec': 'operator',
  'audio:read': 'viewer',
  'audio:exec': 'operator',
  'atem:read': 'viewer',
  'atem:exec': 'operator',
  'obs:read': 'viewer',
  'obs:exec': 'operator',
  'users:read': 'admin',
  'users:write': 'admin',
  'audit:read': 'operator',
};

export function canDo(role: Role, action: Action): boolean {
  return hasMinRole(role, ACTION_MIN[action]);
}
