import { setCategory } from "../../packages/core/state/store";
import type {
  GameStateMessage,
  GameTransport,
  GameTransportConnection,
  GameTransportHandlers,
} from "../../packages/web/lib/gameSocket";
import type { DirectoryHandle } from "./files";

type WorkerStateMessage = {
  type: "state";
  category: string;
  data: unknown;
  updatedAt: number;
};

type BrowserWorkerMessage =
  | WorkerStateMessage
  | { type: "ready" }
  | { type: "error"; message: string }
  | { type: "actionAck"; requestId?: string; ok: boolean; body: string }
  | { type: "actionError"; requestId?: string; message: string };

export type BrowserTransport = {
  transport: GameTransport;
  worker: Worker;
  dispose(): void;
};

export function makeBrowserTransport(data: DirectoryHandle, install?: DirectoryHandle): BrowserTransport {
  const worker = new Worker(new URL("./watcher.worker.js", import.meta.url), { type: "module" });
  const messages = new Map<string, GameStateMessage>();
  let handlers: GameTransportHandlers | null = null;
  let ready = false;

  worker.onmessage = (event: MessageEvent<BrowserWorkerMessage>) => {
    const message = event.data;
    if (message.type === "ready") {
      ready = true;
      handlers?.onOpen();
      return;
    }
    if (message.type === "error") {
      handlers?.onClose();
      return;
    }
    if (message.type !== "state") return;
    const snapshot = {
      category: message.category,
      data: message.data,
      updatedAt: message.updatedAt,
    } as GameStateMessage;
    messages.set(message.category, snapshot);
    setCategory(message.category, message.data, message.updatedAt);
    handlers?.onMessage(snapshot);
  };

  worker.postMessage({ type: "init", data, install });

  const transport: GameTransport = {
    connect(next) {
      handlers = next;
      if (ready) {
        next.onOpen();
        for (const snapshot of messages.values()) next.onMessage(snapshot);
      }
      const connection: GameTransportConnection = {
        send(message) {
          worker.postMessage(message);
        },
        close() {
          if (handlers !== next) return;
          handlers = null;
          next.onClose();
        },
      };
      return connection;
    },
  };

  return {
    transport,
    worker,
    dispose() {
      handlers?.onClose();
      handlers = null;
      worker.terminate();
    },
  };
}
