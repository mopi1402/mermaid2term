import { treemapKeyParts } from "../../canvas/keys.js";
import { type KindSelector } from "./model.js";

const drawn = (part: string) => (key: string): boolean => treemapKeyParts(key)?.[0] === part;

// Measured on mermaid 12.0.0 headless: `.treemapLeaf` strokes a leaf's box, `.treemapSection` a branch's.
export const TREEMAP_SELECTORS: readonly KindSelector[] = [
  { selectors: [".treemapLeaf"], keys: drawn("box"), fill: "none" },
  { selectors: [".treemapSection"], keys: drawn("frame"), fill: "none" },
];
