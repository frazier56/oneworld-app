/**
 * PREVIEW ENTRY — the double-clickable UAT file's boot (VITE_PREVIEW=1 builds only).
 * Seeds the demo session + network fixtures BEFORE the app loads, then mounts the real App.
 * The real entry (main.tsx) knows nothing about any of this.
 */
import { createRoot } from "react-dom/client";
import { installPreviewFixtures } from "./previewFixtures";
import "@oneworld/shell/tokens.css";

installPreviewFixtures();

import("./App").then(({ default: App }) => {
  createRoot(document.getElementById("root")!).render(<App />);
});
