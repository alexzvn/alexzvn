import { z } from 'zod';
import { DeviceSchema, DiscoveredDeviceSchema } from './device';
import { TricasterConfigSchema } from './tricaster';
import { PtzActionSchema, PtzCameraConfigSchema } from './ptz';
import { ROLES, type Role } from './roles';

// ===== Socket.IO event payload schemas =====

export const RoleSchema = z.enum(ROLES as [Role, ...Role[]]);

export const SessionUserSchema = z.object({
  id: z.number().int(),
  username: z.string(),
  role: RoleSchema,
});
export type SessionUser = z.infer<typeof SessionUserSchema>;

export const InventoryStateSchema = z.object({
  devices: z.array(DeviceSchema),
});
export type InventoryState = z.infer<typeof InventoryStateSchema>;

export const InventoryUpsertSchema = z.object({
  device: DeviceSchema,
});
export const InventoryRemoveSchema = z.object({
  id: z.string(),
});

export const DiscoveryResultSchema = z.object({
  results: z.array(DiscoveredDeviceSchema),
});

export const DiscoveryDoneSchema = z.object({
  count: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
});

export const TricasterStatusSchema = z.object({
  id: z.string(),
  state: z.enum(['connected', 'polling', 'down']),
  version: z.string().optional(),
  lastChecked: z.number(),
  lastError: z.string().optional(),
});
export type TricasterStatusEvent = z.infer<typeof TricasterStatusSchema>;

export const TricasterExecSchema = z.object({
  tricasterId: z.string().min(1),
  shortcut: z.string().min(1),
  params: z.record(z.string()).optional(),
});

export const PtzStatusSchema = z.object({
  id: z.string(),
  state: z.enum(['connected', 'polling', 'down']),
  power: z.enum(['on', 'standby']).optional(),
  lastChecked: z.number(),
  lastError: z.string().optional(),
});
export type PtzStatusEvent = z.infer<typeof PtzStatusSchema>;

export const PtzExecSchema = z.object({
  cameraId: z.string().min(1),
  action: PtzActionSchema,
});

export const AuditEntrySchema = z.object({
  id: z.number().int(),
  ts: z.number(),
  username: z.string(),
  action: z.string(),
  target: z.string().optional(),
  payload: z.unknown().optional(),
});
export type AuditEntry = z.infer<typeof AuditEntrySchema>;

// ===== HTTP request/response schemas =====

export const LoginRequestSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const LoginResponseSchema = z.object({
  token: z.string(),
  user: SessionUserSchema,
});

export const CreateUserRequestSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(6),
  role: RoleSchema,
});

export const UpdateUserRequestSchema = z.object({
  password: z.string().min(6).optional(),
  role: RoleSchema.optional(),
});

// ===== Event name constants =====

export const EVENTS = {
  // server → client
  INVENTORY_STATE: 'inventory:state',
  DISCOVERY_START: 'discovery:start',
  DISCOVERY_RESULT: 'discovery:result',
  DISCOVERY_DONE: 'discovery:done',
  TRICASTER_STATE: 'tricaster:state',
  TRICASTER_STATUS: 'tricaster:status',
  PTZ_STATE: 'ptz:state',
  PTZ_STATUS: 'ptz:status',
  AUDIT_APPEND: 'audit:append',
  USERS_STATE: 'users:state',

  // client → server (intents)
  INVENTORY_UPSERT: 'inventory:upsert',
  INVENTORY_REMOVE: 'inventory:remove',
  DISCOVERY_RUN: 'discovery:run',
  TRICASTER_EXEC: 'tricaster:exec',
  PTZ_EXEC: 'ptz:exec',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

export { DeviceSchema, DiscoveredDeviceSchema, TricasterConfigSchema, PtzCameraConfigSchema };
