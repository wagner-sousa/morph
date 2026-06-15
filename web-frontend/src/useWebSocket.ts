import { useEffect, useRef, useState } from 'react';

export interface WsMessage {
  channel: string;
  event: string;
  data: unknown;
  timestamp: string;
}

/** Subscribe to MORPH's realtime WebSocket with auto-reconnect. */
export function useWebSocket(onMessage: (msg: WsMessage) => void): boolean {
  const [connected, setConnected] = useState(false);
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;

  useEffect(() => {
    let socket: WebSocket | undefined;
    let retry: ReturnType<typeof setTimeout>;
    let closed = false;

    const connect = () => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      socket = new WebSocket(`${proto}://${location.host}/ws`);
      socket.onopen = () => setConnected(true);
      socket.onclose = () => {
        setConnected(false);
        if (!closed) retry = setTimeout(connect, 2000);
      };
      socket.onmessage = (ev) => {
        try {
          handlerRef.current(JSON.parse(ev.data) as WsMessage);
        } catch {
          /* ignore */
        }
      };
    };
    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      socket?.close();
    };
  }, []);

  return connected;
}
