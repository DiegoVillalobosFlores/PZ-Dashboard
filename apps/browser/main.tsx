import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "../../packages/web/App";
import "../../packages/web/index.css";
import { browserCodecs } from "./codecs";
import { browserRoutes } from "./routes";
import { getCacheDirectory, makeBrowserFiles } from "./files";
import {
  confirmData,
  confirmInstall,
  requestData,
  requestInstall,
  restoreAccess,
  type BrowserAccess,
} from "./grants";
import { makeBrowserTransport, type BrowserTransport } from "./transport";
import { setGameActionsEnabled, setGameTransport, useServerConnection } from "../../packages/web/lib/gameSocket";

function BrowserNotice({ message, children }: { message: string; children?: React.ReactNode }) {
  return <main style={{ padding: 32, color: "white", background: "#111", minHeight: "100vh" }}>{message}{children && <div style={{ marginTop: 16 }}>{children}</div>}</main>;
}

function ActionButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ padding: "10px 14px", color: "white", background: "#2e6f8e", border: "1px solid #72c4df", borderRadius: 4, cursor: "pointer" }}
    >
      {children}
    </button>
  );
}

function BrowserBanner({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", left: 12, right: 12, bottom: 12, zIndex: 20, padding: "10px 14px", color: "white", background: "rgba(14, 20, 25, .92)", border: "1px solid rgba(255,255,255,.2)", borderRadius: 6, fontSize: 12 }}>
      {children}
    </div>
  );
}

function BrowserConnectionStatus() {
  const connection = useServerConnection();
  if (connection.modConnected) return null;
  return <div>Waiting for game data…</div>;
}

function Root() {
  const supported = window.isSecureContext && typeof window.showDirectoryPicker === "function";
  const [access, setAccess] = React.useState<BrowserAccess | null>(null);
  const [runtimeReady, setRuntimeReady] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = React.useState(false);
  const [installMessage, setInstallMessage] = React.useState<string | null>(null);
  const [assetBusy, setAssetBusy] = React.useState(false);

  React.useEffect(() => {
    if (!supported) return;
    void restoreAccess()
      .then((restored) => {
        setAccess(restored);
        setInstallPrompt(Boolean(restored?.installNeedsConfirmation || restored?.installError));
      })
      .catch((reason) => setError(String(reason)));
  }, [supported]);

  React.useEffect(() => {
    if (!supported || !access || access.dataNeedsConfirmation) {
      setRuntimeReady(false);
      return;
    }
    const currentAccess = access;

    let cancelled = false;
    let browserTransport: BrowserTransport | undefined;
    const originalFetch = window.fetch.bind(window);

    async function setup() {
      const cache = await getCacheDirectory();
      if (cancelled) return;
      const install = currentAccess.install && !currentAccess.installNeedsConfirmation && !currentAccess.installError ? currentAccess.install : undefined;
      const files = makeBrowserFiles(currentAccess.data, install, cache);
      const routes = browserRoutes(files, browserCodecs);

      window.fetch = (async (input, init) => {
        const request = new Request(input, init);
        const path = new URL(request.url).pathname;
        const local = path.startsWith("/api/") || path.startsWith("/game-icons/");
        if (!local) return originalFetch(input, init);
        if (path.startsWith("/api/map/") || path.startsWith("/api/model/") || path.startsWith("/game-icons/")) {
          if (!install) {
            setInstallPrompt(true);
            return new Response("Game install directory access is required.", { status: 424 });
          }
        }
        try {
          setAssetBusy(true);
          return await routes(request);
        } catch (reason) {
          return new Response(String(reason), { status: 500 });
        } finally {
          setAssetBusy(false);
        }
      }) as typeof window.fetch;

      browserTransport = makeBrowserTransport(currentAccess.data, install);
      setGameActionsEnabled(currentAccess.dataWritable);
      setGameTransport(browserTransport.transport);
      window.dispatchEvent(new Event("pz-dashboard-assets-ready"));
      setRuntimeReady(true);
    }

    void setup().catch((reason) => {
      if (!cancelled) setError(String(reason));
    });

    return () => {
      cancelled = true;
      window.fetch = originalFetch;
      setGameActionsEnabled(false);
      setGameTransport(null);
      browserTransport?.dispose();
      setRuntimeReady(false);
    };
  }, [supported, access?.data, access?.dataNeedsConfirmation, access?.dataWritable, access?.install, access?.installNeedsConfirmation, access?.installError]);

  if (!window.isSecureContext) return <BrowserNotice message="Secure origin required. Use the server app in this browser." />;
  if (!supported) return <BrowserNotice message="This browser lacks File System Access support. Use the server app for this browser or for phone and handheld access." />;
  if (error && !access) return <BrowserNotice message={error} />;
  if (!access) {
    return (
      <BrowserNotice message="Browser Direct mode reads game files only on this machine. Choose your Zomboid Lua directory, the folder containing PZDashboard_*.json, to begin.">
        <ActionButton onClick={() => void requestData().then(setAccess).catch((reason) => setError(String(reason)))}>Choose Zomboid data directory</ActionButton>
      </BrowserNotice>
    );
  }
  if (access.dataNeedsConfirmation) {
    return (
      <BrowserNotice message="Browser retained your Zomboid data directory, but permission lapsed. Re-confirm access without choosing it again.">
        <ActionButton onClick={() => void confirmData(access).then(setAccess).catch((reason) => setError(String(reason)))}>Re-confirm data directory</ActionButton>
      </BrowserNotice>
    );
  }
  if (error) return <BrowserNotice message={error} />;
  const currentAccess = access;

  async function grantInstall() {
    try {
      const next = currentAccess.install && currentAccess.installNeedsConfirmation && !installMessage ? await confirmInstall(currentAccess) : await requestInstall(currentAccess);
      setAccess(next);
      setInstallPrompt(false);
      setInstallMessage(null);
    } catch (reason) {
      setInstallMessage(String(reason));
      setInstallPrompt(true);
    }
  }

  return (
    <>
      {runtimeReady ? <App /> : <BrowserNotice message="Preparing local game access…" />}
      <>
        <BrowserBanner>
          {runtimeReady && <BrowserConnectionStatus />}
          {!access.dataWritable && <div>Actions disabled: write access to Zomboid data directory is required.</div>}
          {(installPrompt || installMessage) && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span>{installMessage ?? "Game install directory is needed for map, item, and character assets."}</span>
              <ActionButton onClick={() => void grantInstall()}>{installMessage ? "Choose different directory" : currentAccess.installNeedsConfirmation ? "Re-confirm install access" : "Choose game install directory"}</ActionButton>
            </div>
          )}
          {assetBusy && <div style={{ marginTop: 6 }}>Preparing local game assets…</div>}
          <div style={{ marginTop: 6, opacity: .75 }}>Browser Direct mode stays on this machine. Use the server app for a phone or another device.</div>
        </BrowserBanner>
      </>
    </>
  );
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><Root /></React.StrictMode>);
