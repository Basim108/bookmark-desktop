import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { seedDefaultFolderIcon } from "../lib/storage/defaultFolderIcon";
import "./main.css";

// Ensure the shared default folder icon exists before the sidebar renders
// icon-less folders. Fire-and-forget: the seed no-ops once present.
void seedDefaultFolderIcon();

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root element not found");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
