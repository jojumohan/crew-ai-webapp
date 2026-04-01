import { io, Socket } from 'socket.io-client';

let _socket: Socket | null = null;

export function initSocket(token: string): Socket {
  if (_socket?.connected) return _socket;
  _socket = io(process.env.NEXT_PUBLIC_WS_URL ?? '', {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });
  return _socket;
}

export function getSocket(): Socket | null { return _socket; }

export function disconnectSocket() { _socket?.disconnect(); _socket = null; }
