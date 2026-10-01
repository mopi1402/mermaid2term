import { SECTION_FOREGROUND_PREFIX, SECTION_PREFIX, TIMELINE_EVENT_PREFIX, indexAfter } from "../../canvas/keys.js";
import { type KindSelector, type Unread } from "./model.js";

// mermaid 12 numbers a box's `.section-N` from -1, over twelve: the thirteenth section is back on `.section--1`.
const SECTIONS = 12;
const FIRST = -1;
const FONT_ONLY: readonly Unread[] = ["fill", "stroke", "color"];
const FILL_ONLY: readonly Unread[] = ["stroke", "color", "font"];

// The section a key draws for, as mermaid numbers it: `section:N` is a header's band, `sectionfg:N` a period's words.
const numbered = (prefix: string, key: string): number | undefined => {
  const at = indexAfter(key, prefix);
  return at === undefined ? undefined : (at % SECTIONS) + FIRST;
};
const band = (key: string): number | undefined => numbered(SECTION_PREFIX, key);
const period = (key: string): number | undefined => numbered(SECTION_FOREGROUND_PREFIX, key);
const event = (key: string): number | undefined => numbered(TIMELINE_EVENT_PREFIX, key);
const boxed = (key: string): number | undefined => period(key) ?? event(key);
const anySection = (key: string): boolean => band(key) !== undefined || boxed(key) !== undefined;

const inSection = (section: number): readonly KindSelector[] => {
  const name = `.section-${section}`;
  return [
    { selectors: [`${name} path`], keys: (key) => band(key) === section, fill: "ground", unread: FILL_ONLY },
    { selectors: [`${name} path`], keys: (key) => boxed(key) === section, fill: "ink", unread: FILL_ONLY },
    { selectors: [`${name} text`], keys: (key) => band(key) === section, fill: "ink", unread: ["color"] },
    { selectors: [`${name} text`, name], keys: (key) => boxed(key) === section, fill: "ink", unread: FONT_ONLY },
    { selectors: [name], keys: (key) => band(key) === section, fill: "ink", unread: FONT_ONLY },
  ];
};

// Measured on mermaid 12.0.0 headless: `.section-N path` fills section N's boxes, drawn here as a header's band and a
// period's or an event's ink, `.section-N text` inks their words. A box's own fill wins over `.section-N`, `.timeline-node`,
// `.taskWrapper` and `.eventWrapper`, which only reach the words' font.
export const TIMELINE_SELECTORS: readonly KindSelector[] = [
  ...Array.from({ length: SECTIONS }, (_, at) => inSection(at + FIRST)).flat(),
  { selectors: [".timeline-node"], keys: anySection, fill: "ink", unread: FONT_ONLY },
  { selectors: [".taskWrapper"], keys: (key) => period(key) !== undefined, fill: "ink", unread: FONT_ONLY },
  { selectors: [".eventWrapper"], keys: (key) => event(key) !== undefined, fill: "ink", unread: FONT_ONLY },
];
