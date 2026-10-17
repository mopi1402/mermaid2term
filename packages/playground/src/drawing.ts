import { renderThemedText, type Background, type BorderMode } from "@tayomi/mermaid2term";

import { grid } from "@/grid";

export type Drawing = { ok: true; html: string; plain: string; elapsed: number } | { ok: false; error: string };

export const draw = (
  source: string,
  width: number,
  height: number | undefined,
  theme: string,
  autoRotate: boolean,
  autoWrap: boolean,
  borders: BorderMode,
  charset: string,
  background: Background
): Drawing => {
  try {
    // Timed like mermaid's badge: the drawing AND the string a terminal receives; the HTML grid is the page's cost.
    const started = performance.now();
    const options = { width, height, autoRotate, autoWrap, borders, charset, background };
    const painted = renderThemedText(source, options, theme);
    const ansi = painted.toAnsi();
    const elapsed = performance.now() - started;
    return { ok: true, html: grid(ansi), plain: painted.plain, elapsed };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
};
