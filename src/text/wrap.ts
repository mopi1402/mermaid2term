import { numberOf } from "./format.js";
import type { Declared } from "../source/config.js";

export const MAX_LABEL_WIDTH = 20;

// The pixels one character of mermaid's text takes on average, measured on mermaid.live 12.0.0 (2026-09-27): its
// widest line holds 12 characters at 100px, 16 at 120px, 29 at 200px and 69 at 500px.
const PX_PER_CHARACTER = 7.25;

// A width mermaid states in pixels (`wrappingWidth`, `maxNodeWidth`), read in columns.
export const cellsFor = (px: number): number => Math.max(1, Math.floor(px / PX_PER_CHARACTER));

const WRAPPING_WIDTH_KEY = "wrappingWidth";

// `config.<kind>.wrappingWidth`, the pixels mermaid wraps a node's text at, read in columns.
export function wrapOf(said: Declared): number {
  const px = numberOf(said[WRAPPING_WIDTH_KEY] ?? "");
  return px !== undefined && px > 0 ? cellsFor(px) : MAX_LABEL_WIDTH;
}
