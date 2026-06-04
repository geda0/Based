import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { resolveRegistry } from "./lib/sources.js";
import "./styles.css";
const registry = resolveRegistry({
  useRemote: import.meta.env.VITE_USE_REMOTE_SOURCE === "1",
  baseUrl: import.meta.env.VITE_API_BASE_URL,
});
createRoot(document.getElementById("root")!).render(<StrictMode><App registry={registry} /></StrictMode>);
