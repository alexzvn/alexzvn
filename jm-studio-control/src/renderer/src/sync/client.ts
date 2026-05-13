import { io, type Socket } from 'socket.io-client';

const DEFAULT_PORT = 7778;

let socket: Socket | null = null;

export function resolveServerUrl(): string {
  if (typeof window !== 'undefined' && window.jms?.serverUrl) {
    return window.jms.serverUrl;
  }
  if (typeof window !== 'undefined' && window.location) {
    const loc = window.location;
    return `${loc.protocol}//${loc.hostname}:${DEFAULT_PORT}`;
  }
  return `http://127.0.0.1:${DEFAULT_PORT}`;
}

export function getApiBase(): string {
  return resolveServerUrl();
}

interface ConnectHandlers {
  onState?: (event: string, payload: unknown) => void;
  onConnectionChange?: (connected: boolean) => void;
  onError?: (message: string) => void;
}

export function connect(url: string, token: string | null, handlers: ConnectHandlers): Socket {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  const sock = io(url, {
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 200,
    reconnectionDelayMax: 2000,
    auth: token ? { token } : undefined,
  });

  sock.on('connect', () => handlers.onConnectionChange?.(true));
  sock.on('disconnect', () => handlers.onConnectionChange?.(false));
  sock.on('connect_error', (err) => handlers.onError?.(err.message));

  sock.onAny((event, payload) => handlers.onState?.(event, payload));

  socket = sock;
  return sock;
}

export function getSocket(): Socket | null {
  return socket;
}

export function emit(event: string, payload?: unknown): void {
  if (!socket?.connected) {
    console.warn('[jms] dropped emit — not connected', event);
    return;
  }
  socket.emit(event, payload);
}

export function emitWithAck<T = unknown>(event: string, payload?: unknown): Promise<T> {
  if (!socket?.connected) return Promise.reject(new Error('not_connected'));
  return new Promise((resolve, reject) => {
    socket!.emit(event, payload, (res: T) => {
      if (res && typeof res === 'object' && 'ok' in res && (res as { ok: boolean }).ok === false) {
        reject(new Error((res as { error?: string }).error ?? 'request_failed'));
      } else {
        resolve(res);
      }
    });
  });
}

export function disconnect(): void {
  socket?.disconnect();
  socket = null;
}

export async function apiFetch<T>(path: string, init: RequestInit & { token?: string | null } = {}): Promise<T> {
  const { token, headers, ...rest } = init;
  const res = await fetch(`${getApiBase()}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body}`);
  }
  return (await res.json()) as T;
}
