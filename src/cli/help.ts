import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CHARSET_NAMES, DEFAULT_CHARSET } from "../index.js";
import { PROGRAM } from "./exits.js";

// A wrapped usage line hangs under the first option, so the indent is the opening's own width and not a count.
const WRAP = " ".repeat("usage: ".length + PROGRAM.length + 1);

export const HELP = `usage: ${PROGRAM} [-h] [--charset NAME] [--padding-x PADDING_X] [--padding-y PADDING_Y]
${WRAP}[--gap GAP] [--width WIDTH] [--height HEIGHT] [--sharp-edges] [--borders MODE] [--theme THEME]
${WRAP}[--background BG] [--no-auto-fit] [-o FILE] [--show-ids] [--json TYPE]
${WRAP}[--themes] [--demo [TYPE]] [--check-background] [--version]
${WRAP}[file]

Render Mermaid diagrams as Unicode art in the terminal

positional arguments:
  file                  Mermaid diagram file (.mmd). Reads from stdin if not provided.

options:
  -h, --help            show this help message and exit
  --charset NAME        The set of characters to draw with: ${CHARSET_NAMES.join(", ")} (default ${DEFAULT_CHARSET})
  --padding-x PADDING_X
                        Horizontal padding inside node boxes (default: 4)
  --padding-y PADDING_Y
                        Vertical padding inside node boxes (default: 2)
  --gap GAP             Space between nodes (default: 4). Use 1 or 2 for compact diagrams.
  --width WIDTH         Max output width. Re-renders with smaller gap/padding if exceeded.
  --height HEIGHT       Max output rows. Re-renders tighter; a sequence taller still repeats its participants at the foot.
  --sharp-edges         Use sharp corners on edge turns instead of rounded
  --borders MODE        How a box's border is drawn: default, padless (the line moved to the inner edge of its
                        cell, the fill touching it) or borderless (a slab of the fill, no border)
  --borderless          The same as --borders borderless
  --theme THEME         Color theme (default: default, mermaid's own). A theme the source names in its
                        frontmatter wins over it. Colour is on wherever the console shows it, or FORCE_COLOR is set.
  --background BG       What lies under the drawing: light, dark, or a #rrggbb colour. Unstated, the terminal
                        is asked for its background (OSC 11), then the environment is read (TERMINAL_BACKGROUND,
                        TERMINAL_COLOR_SCHEME, then COLORFGBG); a theme with a twin on that side switches to it,
                        and a colour the diagram declares is kept readable on it.
  --no-auto-fit         Disable automatic compaction when diagram exceeds terminal width
  -o FILE, --output FILE
                        Write output to file instead of stdout
  --show-ids            Show node IDs alongside labels (e.g. 'A: Start') for debugging.
  --json TYPE           Read JSON/tabular data from stdin and render as TYPE.
  --themes              List available color themes and exit.
  --demo [TYPE]         Render sample diagrams. Use 'all' or a type name (flowchart, sequence, etc.).
  --check-background    Report what the terminal and the environment say about the background (OSC 11,
                        TERMINAL_BACKGROUND, TERMINAL_COLOR_SCHEME, COLORFGBG), then draw tints and a few
                        themes on the ground that was resolved, to judge by eye.
  --version             show program's version number and exit`;

export function version(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  for (const candidate of [path.join(here, "..", "package.json"), path.join(here, "..", "..", "package.json")]) {
    try {
      return (JSON.parse(fs.readFileSync(candidate, "utf8"))).version;
    } catch {
      continue;
    }
  }
  return "0.0.0";
}

