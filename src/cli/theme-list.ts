import { THEMES } from "../index.js";
import { OK, out } from "./exits.js";

// Wide enough for `redux-dark-color`, mermaid's longest, which used to push the column out of true.
const THEME_NAME_WIDTH = 17;

const THEME_NOTES: ReadonlyMap<string, string> = new Map([
  ["mono", "No colour at all, weight alone: the default, and the one that reads on any terminal"],
  ["classic", "Cyan nodes, yellow arrows, white labels: this package's own, named `default` until mermaid's arrived"],
  ["terra", "Warm earth tones (browns, oranges)"],
  ["neon", "Magenta nodes, green arrows, cyan edges"],
  ["amber", "Amber/gold CRT-style"],
  ["phosphor", "Green phosphor terminal"],
  ["gruvbox", "Gruvbox dark palette"],
  ["monokai", "Monokai dark with pink/green accents"],
  ["dracula", "Dracula purple/pink/green palette"],
  ["nord", "Nord muted blue/cyan arctic palette"],
  ["solarized", "Solarized dark blue/yellow/cyan"],
  ["base", "mermaid: the theme its others are derived from, cream on a pale page"],
  ["dark", "mermaid: its dark theme, greys and a violet primary"],
  ["default", "mermaid: the theme it draws with when nobody names one, lavender on white"],
  ["forest", "mermaid: greens on white"],
  ["neutral", "mermaid: greys, made to print"],
  ["neo", "mermaid: its newer light theme, blue-grey"],
  ["neo-dark", "mermaid: the same, on a dark page"],
  ["redux", "mermaid: light, muted violet"],
  ["redux-dark", "mermaid: the same, on a dark page"],
  ["redux-color", "mermaid: light, with a saturated scale"],
  ["redux-dark-color", "mermaid: the same, on a dark page"],
]);

export function listThemes(): number {
  for (const theme of THEMES.values()) {
    const note = THEME_NOTES.get(theme.name) ?? "";
    out(`  ${theme.name.padEnd(THEME_NAME_WIDTH)} ${note}`);
  }
  return OK;
}
