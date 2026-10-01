import { type ThemeSource } from "./theme-model.js";
import { MERMAID_THEME_FILES } from "./replay/replay.js";

// mermaid's sequence stylesheet strokes every lifeline 2px, on all eleven themes, and not by the half pixel the
// `.actor-line` element carries in its own attribute.
const MERMAID_LIFELINE_WIDTH = 2;

// The fade a sequence block's frame is drawn at, 0.65 on these two where every other theme takes 0.5
// (`docs/divergences.md`).
const BOLDER_FRAMES: ReadonlyMap<string, number> = new Map([["dark", 0.65], ["default", 0.65]]);

// Each theme file with nothing written over it: its variables are its own `updateColors` replayed (`derive.ts`).
export const MERMAID_THEMES: readonly ThemeSource[] = MERMAID_THEME_FILES.map((name) => ({
  name,
  variables: {},
  frameOpacity: BOLDER_FRAMES.get(name),
  lifelineWidth: MERMAID_LIFELINE_WIDTH,
}));

export const MERMAID_THEME_NAMES: readonly string[] = MERMAID_THEMES.map((theme) => theme.name);
