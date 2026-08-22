import { useRef } from 'react';
import useSWRSubscription from 'swr/subscription';
import { wsUrl } from './api';
import type { CategoryMap, ConnectionSnapshot } from './liveTypes';

export type GameCategory = keyof CategoryMap;

// Discriminated on `category`, so a handler narrowing with
// `msg.category === 'map'` gets `msg.data` typed as MapSnapshot - no casts at
// the call sites.
export type GameStateMessage = {
  [K in GameCategory]: { category: K; data: CategoryMap[K]; updatedAt: number };
}[GameCategory];

type MessageListener = (msg: GameStateMessage) => void;
type ConnectionListener = (connected: boolean) => void;
type ServerConnectionListener = (snapshot: ConnectionSnapshot) => void;

export type GameTransportHandlers = {
  onMessage(message: GameStateMessage): void;
  onOpen(): void;
  onClose(): void;
};

export type GameTransportConnection = {
  send(message: unknown): void;
  close(): void;
};

export type GameTransport = {
  connect(handlers: GameTransportHandlers): GameTransportConnection;
};

const RECONNECT_DELAY_MS = 2000;
// Grace period before tearing down a socket nothing is subscribed to. React
// StrictMode's dev double-mount - and any navigation that momentarily drops
// the last subscriber - takes the ref count to 0 and straight back to 1;
// without this the socket would close and reconnect on every one of those.
const IDLE_CLOSE_DELAY_MS = 1000;
// The mod's fastest collector (map position) writes every 500ms, so a few
// missed cycles is the shortest gap that isn't just write jitter.
const MOD_TIMEOUT_MS = 3000;
const MOD_POLL_MS = 1000;

// One socket for the whole app, shared by every subscription. `useSWRSubscription`
// ref-counts *per key*, so each distinct key runs its own subscribe(); routing
// them all through this module is what keeps that to a single connection.
const messageListeners = new Set<MessageListener>();
const connectionListeners = new Set<ConnectionListener>();
const serverConnectionListeners = new Set<ServerConnectionListener>();
const actionListeners = new Set<ConnectionListener>();

// Last snapshot seen per category. The server replays every category when a
// socket opens, but the socket now outlives any individual screen - a
// component mounting mid-session would otherwise render empty until the mod
// next pushed that category (up to seconds for slow ones). Replaying this on
// subscribe gives late mounters the same immediate state the old
// always-mounted provider had accumulated for them.
const latest = new Map<GameCategory, GameStateMessage>();

let socket: WebSocket | null = null;
let connected = false;
let serverConnection: ConnectionSnapshot = { connected: false, modConnected: false, updatedAt: 0 };
let lastStateAt = 0;
let refCount = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let idleCloseTimer: ReturnType<typeof setTimeout> | undefined;
let modPollTimer: ReturnType<typeof setInterval> | undefined;
let transport: GameTransport | null | undefined;
let transportConnection: { connection: GameTransportConnection; generation: number } | null = null;
let transportGeneration = 0;
let actionsEnabled = true;

export function setGameTransport(next: GameTransport | null | undefined): void {
  if (transport === next) return;
  closeSocket();
  transport = next;
  if (refCount > 0) connect();
}

export function setGameActionsEnabled(next: boolean): void {
  if (actionsEnabled === next) return;
  actionsEnabled = next;
  for (const listener of [...actionListeners]) listener(next);
}

export function randomId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function setConnected(next: boolean) {
  if (connected === next) return;
  connected = next;
  for (const listener of [...connectionListeners]) listener(next);
  publishServerConnection();
}

// The mod is "connected" if fresh game data landed recently. Nothing on the
// wire says so: the server holds its last snapshot forever and happily replays
// it to a browser opened hours after the game closed, so liveness is measured
// here from the arrival of state the client hasn't already seen.
function publishServerConnection() {
  const modConnected = connected && Date.now() - lastStateAt < MOD_TIMEOUT_MS;
  if (serverConnection.connected === connected && serverConnection.modConnected === modConnected) return;
  serverConnection = { connected, modConnected, updatedAt: lastStateAt };
  for (const listener of [...serverConnectionListeners]) listener(serverConnection);
}

function receiveMessage(msg: GameStateMessage) {
  if (latest.get(msg.category)?.updatedAt !== msg.updatedAt) {
    lastStateAt = Date.now();
    publishServerConnection();
  }
  latest.set(msg.category, msg);
  for (const listener of [...messageListeners]) listener(msg);
}

function retryConnection() {
  clearTimeout(reconnectTimer);
  if (refCount > 0) reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
}

function connect() {
  if (socket || transportConnection) return;
  if (transport === null) return;
  if (transport) {
    const generation = ++transportGeneration;
    const connection = transport.connect({
      onMessage: receiveMessage,
      onOpen: () => {
        if (transportConnection?.generation === generation) setConnected(true);
      },
      onClose: () => {
        if (transportConnection?.generation !== generation) return;
        transportConnection = null;
        setConnected(false);
        retryConnection();
      },
    });
    transportConnection = { connection, generation };
    return;
  }
  const ws = new WebSocket(wsUrl());
  socket = ws;

  ws.onopen = () => setConnected(true);

  ws.onmessage = (event) => {
    let raw: { type?: string; category?: GameCategory; data?: unknown; updatedAt?: number };
    try {
      raw = JSON.parse(event.data as string);
    } catch {
      return;
    }
    if (raw.type !== 'state' || !raw.category) return;

    receiveMessage({
      category: raw.category,
      data: raw.data,
      updatedAt: raw.updatedAt ?? Date.now(),
    } as GameStateMessage);
  };

  ws.onclose = () => {
    // A socket we already replaced (or deliberately tore down) closing late
    // must not clobber the current one or resurrect a retry loop.
    if (socket !== ws) return;
    socket = null;
    setConnected(false);
    retryConnection();
  };

  ws.onerror = () => ws.close();
}

function closeSocket() {
  clearTimeout(reconnectTimer);
  const custom = transportConnection;
  transportConnection = null;
  if (custom) {
    setConnected(false);
    custom.connection.close();
    return;
  }
  const ws = socket;
  socket = null;
  setConnected(false);
  if (!ws) return;
  // Closing a socket that's still CONNECTING logs a harmless but noisy browser
  // warning - defer the close until it actually opens instead.
  if (ws.readyState === WebSocket.CONNECTING) {
    ws.addEventListener('open', () => ws.close());
  } else {
    ws.close();
  }
}

function retain() {
  clearTimeout(idleCloseTimer);
  refCount += 1;
  connect();
}

function release() {
  refCount -= 1;
  if (refCount > 0) return;
  idleCloseTimer = setTimeout(() => {
    if (refCount === 0) closeSocket();
  }, IDLE_CLOSE_DELAY_MS);
}

/**
 * Subscribes to the live game-state stream and keeps whatever `onMessage`
 * returns as this subscription's data.
 *
 * `onMessage` runs for every state message on the shared socket; return the
 * next value to store, or `undefined` to ignore the message (the usual case -
 * a handler only cares about one or two categories). `previous` is the value
 * currently held, for handlers that need to merge rather than replace.
 *
 * `key` names the *derived* state, not the category: SWR ref-counts
 * subscriptions per key and only ever runs the first subscriber's handler for
 * a given key. Two components sharing a key therefore share one handler and
 * one value (which is what you want for e.g. two views of the same vitals);
 * two components wanting *different* shapes must use different keys.
 */
export function useGameSubscription<T>(
  key: string,
  onMessage: (msg: GameStateMessage, previous: T | undefined) => T | undefined,
): T | undefined {
  // SWR's subscribe effect is keyed on `key` alone, so it captures the very
  // first handler and never re-runs for a new closure. Route through a ref so
  // the handler still sees current props/state on every message.
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;

  const { data } = useSWRSubscription<T, Error, string>(`game:${key}`, (_swrKey, { next }) => {
    let current: T | undefined;

    const receive: MessageListener = (msg) => {
      const updated = handlerRef.current(msg, current);
      if (updated === undefined) return;
      current = updated;
      next(null, updated);
    };

    retain();
    messageListeners.add(receive);
    for (const msg of latest.values()) receive(msg);

    return () => {
      messageListeners.delete(receive);
      release();
    };
  });

  return data;
}

/** Whether the shared socket is currently open. */
export function useGameConnection(): boolean {
  const { data } = useSWRSubscription<boolean, Error, string>('game:connection', (_swrKey, { next }) => {
    const receive: ConnectionListener = (value) => next(null, value);

    retain();
    connectionListeners.add(receive);
    receive(connected);

    return () => {
      connectionListeners.delete(receive);
      release();
    };
  });

  return data ?? false;
}

export function useServerConnection(): ConnectionSnapshot {
  const { data } = useSWRSubscription<ConnectionSnapshot, Error, string>('game:server-connection', (_key, { next }) => {
    const receive: ServerConnectionListener = (value) => next(null, value);
    retain();
    serverConnectionListeners.add(receive);
    // Going stale is the absence of messages, so only a timer can notice it.
    modPollTimer ??= setInterval(publishServerConnection, MOD_POLL_MS);
    receive(serverConnection);
    return () => {
      serverConnectionListeners.delete(receive);
      if (!serverConnectionListeners.size) {
        clearInterval(modPollTimer);
        modPollTimer = undefined;
      }
      release();
    };
  });
  return data ?? serverConnection;
}

export function useGameActionsEnabled(): boolean {
  const { data } = useSWRSubscription<boolean, Error, string>('game:actions', (_key, { next }) => {
    const receive: ConnectionListener = (value) => next(null, value);
    actionListeners.add(receive);
    receive(actionsEnabled);
    return () => actionListeners.delete(receive);
  });
  return data ?? actionsEnabled;
}

/**
 * Queues an action for the mod. The server acks immediately; the actual result
 * arrives later as a normal `commandResult` state message, so subscribe to that
 * category if you need to react to it.
 */
export function sendAction(action: string, params?: Record<string, unknown>): void {
  if (!actionsEnabled) return;
  const message = { type: 'action', action, params, requestId: randomId() };
  if (transportConnection) {
    transportConnection.connection.send(message);
    return;
  }
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(message));
}
