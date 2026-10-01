import { statementsOf } from "./lines.js";

export const PROP_FILL = "fill";
export const PROP_BACKGROUND_COLOR = "background-color";
const PROP_BACKGROUND = "background";
export const PROP_STROKE = "stroke";
export const PROP_STROKE_DASHARRAY = "stroke-dasharray";
export const PROP_STROKE_WIDTH = "stroke-width";
export const PROP_COLOR = "color";
export const PROP_MARKER_END = "marker-end";
export const PROP_MARKER_START = "marker-start";
const CSS_NONE = "none";

// A CSS keyword is read in any case: `marker-end: NONE` drops the head as `none` does.
export const saysNone = (props: ReadonlyMap<string, string> | undefined, prop: string): boolean => props?.get(prop)?.toLowerCase() === CSS_NONE;

// In the order mermaid honours them: the first one WRITTEN wins, an empty one saying nothing. Reordering these
// silently changes which fill a source gets.
const FILL_PROPS = [PROP_FILL, PROP_BACKGROUND_COLOR, PROP_BACKGROUND] as const;

export const fillOf = (props: ReadonlyMap<string, string>): string | undefined => {
  for (const prop of FILL_PROPS) {
    const written = props.get(prop);
    if (written !== undefined && written !== "") return written;
  }
  return undefined;
};

export const asksFill = (props: ReadonlyMap<string, string> | undefined): boolean =>
  props !== undefined && FILL_PROPS.some((prop) => props.has(prop));

const CSS_BOLD = "bold";
const CSS_ITALIC = "italic";
const CSS_UNDERLINE = "underline";

// A text's CSS font, as the keywords the terminal's styles share with CSS: mermaid lays these on the label itself.
export function fontWordsOf(props: ReadonlyMap<string, string>): string[] {
  const words: string[] = [];
  const weight = props.get("font-weight")?.toLowerCase();
  if (weight === CSS_BOLD || weight === "bolder" || (weight !== undefined && Number(weight) >= 600)) words.push(CSS_BOLD);
  const style = props.get("font-style")?.toLowerCase();
  if (style === CSS_ITALIC || style === "oblique") words.push(CSS_ITALIC);
  const decoration = (props.get("text-decoration") ?? props.get("text-decoration-line"))?.toLowerCase();
  if (decoration?.split(/\s+/u).includes(CSS_UNDERLINE) === true) words.push(CSS_UNDERLINE);
  return words;
}

const PROP_OPACITY = "opacity";
const PROP_FILL_OPACITY = "fill-opacity";
const PROP_STROKE_OPACITY = "stroke-opacity";
const PERCENT = "%";
const OPAQUE = 1;

const alphaOf = (written: string | undefined): number => {
  if (written === undefined) return OPAQUE;
  const value = Number.parseFloat(written);
  if (Number.isNaN(value)) return OPAQUE;
  return Math.min(OPAQUE, Math.max(0, written.trim().endsWith(PERCENT) ? value / 100 : value));
};

export interface Opacities {
  // A node's lines, its words, and its ground, each as the share of it that shows.
  readonly lines: number;
  readonly words: number;
  readonly ground: number;
}

const PROP_DISPLAY = "display";
const PROP_VISIBILITY = "visibility";
const HIDING: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  [PROP_DISPLAY, new Set([CSS_NONE])],
  [PROP_VISIBILITY, new Set(["hidden", "collapse"])],
]);

// `display: none` and `visibility: hidden` show nothing of what they reach, its edges still drawn to where it stands.
export const hides = (props: ReadonlyMap<string, string>): boolean =>
  [...HIDING].some(([prop, values]) => values.has(props.get(prop)?.trim().toLowerCase() ?? ""));

// The properties mermaid hands a node's label rather than its shape, `isLabelStyle` in its rendering util.
const LABEL_PROPS: ReadonlySet<string> = new Set([
  PROP_COLOR, "font-size", "font-family", "font-weight", "font-style", "text-decoration", "text-align", "text-transform",
  "line-height", "letter-spacing", "word-spacing", "text-shadow", "text-overflow", "white-space", "word-wrap",
  "word-break", "overflow-wrap", "hyphens",
]);

export const namesLabel = (props: ReadonlyMap<string, string>): boolean => [...props.keys()].some((prop) => LABEL_PROPS.has(prop.trim().toLowerCase()));

// The share of what a set of properties reaches that shows: none where it hides, its `opacity` otherwise.
const shownBy = (props: ReadonlyMap<string, string>): number => (hides(props) ? 0 : alphaOf(props.get(PROP_OPACITY)));

// mermaid lays a node's CSS on its shape alone, `styles2String` handing the label the text properties only, and a
// `classDef` on the label as well, through the `.name > *` and `.name span` rules of `createCssStyles`. So `opacity`,
// `display` and `visibility` reach the words only from what its classes say, `classed`; `fill-opacity` fades the
// ground alone and `stroke-opacity` the outline alone.
export function opacitiesOf(props: ReadonlyMap<string, string>, classed: ReadonlyMap<string, string> | undefined): Opacities | undefined {
  const whole = shownBy(props);
  const words = classed === undefined ? OPAQUE : shownBy(classed);
  const faded = { lines: whole * alphaOf(props.get(PROP_STROKE_OPACITY)), words, ground: whole * alphaOf(props.get(PROP_FILL_OPACITY)) };
  return faded.lines === OPAQUE && faded.words === OPAQUE && faded.ground === OPAQUE ? undefined : faded;
}

export const CLASSDEF_RE = /^\s*classDef\s+(\S+)\s+(.+?)\s*$/iu;
export const STYLE_RE = /^\s*style\s+(\S+)\s+(.+?)\s*$/iu;
export const CLASS_RE = /^\s*class\s+(\S+)\s+(\S+)\s*$/iu;

export const CLASS_DEFAULT = "default";  // keyword: mermaid's own word here, not a style key

// What a node wears, in mermaid's order: `classDef default`, then its classes as written, then its own `style`.
export function wornProps(
  classDefs: ReadonlyMap<string, ReadonlyMap<string, string>>,
  classes: readonly string[],
  styles: ReadonlyMap<string, string> | undefined
): ReadonlyMap<string, string> | undefined {
  const merged = new Map<string, string>();
  for (const name of [CLASS_DEFAULT, ...classes]) {
    for (const [prop, value] of classDefs.get(name) ?? []) merged.set(prop, value);
  }
  for (const [prop, value] of styles ?? []) merged.set(prop, value);
  return merged.size === 0 ? undefined : merged;
}

const STYLE_CLASS_MARK = ":::";

// mermaid unescapes `\,` in `classDef` ALONE (`addClass`, flowDb): `style` and `linkStyle` split on the comma
// whatever stands before it, so the escape is asked for, never assumed.
const UNESCAPED_COMMA_RE = /(?<!\\),/u;
const ESCAPED_COMMA_RE = /\\,/gu;

// A `;` ends the statement, as the flowchart reads it: `classDef a fill:#f00;` fills, in every kind.
export function parseCssProps(text: string, escapes = false): Map<string, string> {
  const props = new Map<string, string>();
  for (const prop of statementsOf(text)[0].split(escapes ? UNESCAPED_COMMA_RE : ",")) {
    const at = prop.indexOf(":");
    if (at === -1) continue;
    const value = prop.slice(at + 1).trim();
    props.set(prop.slice(0, at).trim(), escapes ? value.replace(ESCAPED_COMMA_RE, ",") : value);
  }
  return props;
}

export function splitStyleClass(raw: string): [string, string | undefined] {
  const at = raw.lastIndexOf(STYLE_CLASS_MARK);
  if (at === -1) return [raw, undefined];
  const styleClass = raw.slice(at + STYLE_CLASS_MARK.length).trim();
  return [raw.slice(0, at).trim(), styleClass === "" ? undefined : styleClass];
}

export function defineClasses(classDefs: Map<string, Map<string, string>>, names: string, props: ReadonlyMap<string, string>): void {
  for (const name of names.split(",")) {
    const known = classDefs.get(name) ?? new Map<string, string>();
    for (const [prop, value] of props) known.set(prop, value);
    classDefs.set(name, known);
  }
}

// A `classDef` or `style` line: the names it is written for, as written, and its properties.
export interface CssLine {
  readonly names: string;
  readonly props: Map<string, string>;
}

// `pattern` holds the names in its first group and the properties in its second.
export function cssLineOf(line: string, pattern: RegExp = CLASSDEF_RE, escapes = false): CssLine | undefined {
  const found = pattern.exec(line) ?? undefined;
  return found === undefined ? undefined : { names: found[1], props: parseCssProps(found[2], escapes) };
}

// A `classDef` line merged into the classes it names, as mermaid's `addClass` merges; false for any other line.
export function readClassDef(
  classDefs: Map<string, Map<string, string>>, line: string, pattern: RegExp = CLASSDEF_RE, escapes = false
): boolean {
  const defined = cssLineOf(line, pattern, escapes);
  if (defined === undefined) return false;
  defineClasses(classDefs, defined.names, defined.props);
  return true;
}
