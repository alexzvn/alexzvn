import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Socket } from 'socket.io';
import { validateSession } from './sessions';
import type { UserRow } from './users';
import { canDo, type Action } from '@shared/roles';

export interface AuthedRequest extends IncomingMessage {
  user?: UserRow;
}

function isLoopbackAddr(addr: string | undefined): boolean {
  if (!addr) return false;
  return (
    addr === '127.0.0.1' ||
    addr === '::1' ||
    addr === '::ffff:127.0.0.1' ||
    addr.startsWith('::ffff:127.')
  );
}

function tokenFromHeader(req: IncomingMessage): string | undefined {
  const h = req.headers['authorization'];
  if (!h || typeof h !== 'string') return undefined;
  if (!h.startsWith('Bearer ')) return undefined;
  return h.slice('Bearer '.length).trim() || undefined;
}

const LOOPBACK_ADMIN: UserRow = {
  id: 0,
  username: 'local',
  role: 'admin',
  created_at: 0,
};

export function authenticateHttp(req: AuthedRequest): UserRow | null {
  if (isLoopbackAddr(req.socket.remoteAddress ?? undefined)) {
    req.user = LOOPBACK_ADMIN;
    return LOOPBACK_ADMIN;
  }
  const token = tokenFromHeader(req);
  const user = validateSession(token);
  if (user) req.user = user;
  return user;
}

export function requireHttpAuth(
  req: AuthedRequest,
  res: ServerResponse,
): UserRow | null {
  const user = authenticateHttp(req);
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'unauthorised' }));
    return null;
  }
  return user;
}

export function requireHttpRole(
  req: AuthedRequest,
  res: ServerResponse,
  action: Action,
): UserRow | null {
  const user = requireHttpAuth(req, res);
  if (!user) return null;
  if (!canDo(user.role, action)) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'forbidden' }));
    return null;
  }
  return user;
}

export function attachSocketAuth(
  io: { use: (fn: (s: Socket, next: (e?: Error) => void) => void) => void },
): void {
  io.use((socket, next) => {
    const remote = socket.handshake.address;
    if (isLoopbackAddr(remote)) {
      socket.data.user = LOOPBACK_ADMIN;
      return next();
    }
    const token =
      (typeof socket.handshake.auth?.token === 'string'
        ? (socket.handshake.auth.token as string)
        : undefined) ??
      (typeof socket.handshake.query?.token === 'string'
        ? (socket.handshake.query.token as string)
        : undefined);
    const user = validateSession(token);
    if (!user) return next(new Error('unauthorised'));
    socket.data.user = user;
    next();
  });
}

export function socketUser(socket: Socket): UserRow {
  const user = socket.data.user as UserRow | undefined;
  if (!user) throw new Error('socket has no user — middleware misconfigured');
  return user;
}

export function socketCan(socket: Socket, action: Action): boolean {
  return canDo(socketUser(socket).role, action);
}
