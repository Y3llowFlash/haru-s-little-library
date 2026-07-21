import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import "./warm-shelf.css";
import "./warm-shelf-depth-pass.css";
import LittleLibrary from "./little-library";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LittleLibrary />
    <Analytics />
  </StrictMode>,
);
