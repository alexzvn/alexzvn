import { io, type Socket } from 'socket.io-client';
import type { Command, SyncedState } from '@shared/timer-state';

const DEFAULT_PORT = 7777;

let socket: Socket | null = null;

/**
 * Resolves the Socket.IO server URL.
 *  - Electron renderer (Operator/Speaker): uses preload's hard-wired loopback URL.
 *  - Browser (Remote view): derives from window.location.hostname:DEFAULT_PORT,
 *    so phones/tablets on the LAN connect back to the host machine.
 */
export function resolveServerUrl(): string {
  if (typeof window !== 'undefined' && window.jm?.serverUrl) {
    return window.jm.serverUrl;
  }
  if (typeof window !== 'undefined' && window.location) {
    const loc = window.location;
    return `${loc.protocol}//${loc.hostname}:${DEFAULT_PORT}`;
  }
  return `http://127.0.0.1:${DEFAULT_PORT}`;
}

export function connect(
  url: string,
  onState: (state: SyncedState) => void,
  onConnectionChange: (connected: boolean) => void,
): Socket {
  if (socket) return socket;

  socket = io(url, {
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 200,
    reconnectionDelayMax: 2000,
  });

  socket.on('connect', () => onConnectionChange(true));
  socket.on('disconnect', () => onConnectionChange(false));
  socket.on('state', onState);

  return socket;
}

export function sendCommand(cmd: Command): void {
  if (!socket?.connected) {
    console.warn('[jm-timer] dropping command — not connected', cmd);
    return;
  }
  socket.emit('cmd', cmd);
}

export function disconnect(): void {
  socket?.disconnect();
  socket = null;
}
