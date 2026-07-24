import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import "./reader-links.css";
import LittleLibrary from "./little-library";
import { installReaderLinkRouter } from "./reader-link-router";

installReaderLinkRouter();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LittleLibrary />
    <Analytics />
  </StrictMode>,
);
