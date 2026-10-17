import {
  DARK_BACKGROUND,
  LIGHT_BACKGROUND,
  MERMAID_THEME_NAMES,
  forMermaid,
  readFrontmatterTheme,
  themeFamilies,
  twinOf,
  type Background,
} from "@tayomi/mermaid2term";

const MERMAID_ORDER = ["default", "base", "forest", "neutral", "neo", "redux", "redux-color"];
const LEADING_OURS = ["classic", "mono"];
const families = themeFamilies();
const mermaidFamilies = [
  ...MERMAID_ORDER.filter((name) => families.includes(name)),
  ...families.filter((name) => MERMAID_THEME_NAMES.includes(name) && !MERMAID_ORDER.includes(name)),
];
const ourFamilies = families.filter((name) => !MERMAID_THEME_NAMES.includes(name));
export const AVAILABLE_THEMES = [
  ...mermaidFamilies,
  ...LEADING_OURS.filter((name) => ourFamilies.includes(name)),
  ...ourFamilies.filter((name) => !LEADING_OURS.includes(name)),
];

// The picker lists families only, so a dark twin the source names shows as its family.
export const pickedTheme = (source: string, fallback: string): string =>
  twinOf(readFrontmatterTheme(source) ?? fallback, LIGHT_BACKGROUND);

const DARK_PAGE = "#0A0A0A";
const LIGHT_PAGE = "#FFFFFF";

export const forMermaidPanel = (source: string, fallback: string, background: Background): string =>
  forMermaid(source, fallback, background, background === DARK_BACKGROUND ? DARK_PAGE : LIGHT_PAGE);
