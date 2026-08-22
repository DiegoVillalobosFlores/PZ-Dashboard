import { startWatcher } from "../../packages/core/state/watcher";
import { makeBrowserFiles, getCacheDirectory, type DirectoryHandle } from "./files";
import { browserCodecs } from "./codecs";
import { browserRoutes } from "./routes";

type InitMessage = { type: "init"; data: DirectoryHandle; install?: DirectoryHandle };
type ActionMessage = { type: "action"; action: string; params?: Record<string, unknown>; requestId?: string };
type WorkerMessage = InitMessage | ActionMessage;

const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<WorkerMessage>) => void) | null;
  postMessage(message: unknown): void;
};

let stop: (() => void) | undefined;

scope.onmessage = (event) => {
  void handle(event.data);
};

async function handle(message: WorkerMessage) {
  if (message.type === "init") {
    stop?.();
    try {
      const files = makeBrowserFiles(message.data, message.install, await getCacheDirectory());
      const routes = browserRoutes(files, browserCodecs);
      browserRoutesForAction = (action) => routes(new Request("http://local/api/action", {
        method: "POST",
        body: JSON.stringify({ action: action.action, params: action.params ?? {} }),
        headers: { "Content-Type": "application/json" },
      }));
      const watcher = await startWatcher(files, "/data", {
        onUpdate: (update) => scope.postMessage({ type: "state", ...update }),
      });
      stop = watcher.stop;
      scope.postMessage({ type: "ready" });
    } catch (error) {
      scope.postMessage({ type: "error", message: String(error) });
    }
    return;
  }

  if (message.type === "action") {
    try {
      const response = await browserRoutesForAction(message);
      scope.postMessage({ type: "actionAck", requestId: message.requestId, ok: response.ok, body: await response.text() });
    } catch (error) {
      scope.postMessage({ type: "actionError", requestId: message.requestId, message: String(error) });
    }
  }
}

let browserRoutesForAction: (message: ActionMessage) => Promise<Response> = async () => new Response("Browser is not initialized", { status: 503 });
