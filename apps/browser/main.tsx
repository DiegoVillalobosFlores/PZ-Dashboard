import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "../../packages/web/App";
import "../../packages/web/index.css";

function BrowserNotice({ message }: { message: string }) {
  return <main style={{ padding: 32, color: "white", background: "#111", minHeight: "100vh" }}>{message}</main>;
}

function Root() {
  if (!window.isSecureContext) return <BrowserNotice message="Secure origin required. Use the server app in this browser." />;
  if (!("showDirectoryPicker" in window)) return <BrowserNotice message="This browser lacks File System Access support. Use the server app." />;
  return <App />;
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><Root /></React.StrictMode>);
