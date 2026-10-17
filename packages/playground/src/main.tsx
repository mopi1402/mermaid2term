import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import { App } from "@/App";
import { addressAtOpening } from "@/hash";

const root = document.getElementById("root") ?? undefined; // boundary: the DOM answers null for a missing node
if (root === undefined) throw new Error("the page has no #root");

const start = await addressAtOpening();

createRoot(root).render(
  <StrictMode>
    <App start={start} />
  </StrictMode>
);
