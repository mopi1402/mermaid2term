import { formatHex } from "../colour/rgb.js";
import { cssColour, themeRgb } from "../colour/colours.js";
import { readMermaidTheme, type MermaidThemeText } from "./theme-block.js";
import { themeFromCss } from "./theme-css.js";
import { BARE, type Ink, markerOf, NO_COLOUR, SCALE_INV_PREFIX, SCALE_LABEL_PREFIX, SCALE_PEER_PREFIX, SCALE_PREFIX, type StatedVariables, type Theme, type ThemeWeights } from "./theme-model.js";
import { CSS_COLOURS, derive, makeTheme } from "./derive.js";

// `under` holds what the block stands on where it writes nothing, a palette of this page's own.
export function fromMermaidBlock(name: string, block: string, under: StatedVariables = {}): Theme {
  const read = readThemeText(readMermaidTheme(block));
  return makeTheme({ name, variables: { ...under, ...read.variables }, weights: read.weights, frameOpacity: read.frameOpacity, ...markerOf(read.marker) });
}

interface ThemeText {
  readonly theme: string | undefined;
  readonly variables: StatedVariables;
  readonly weights: Partial<ThemeWeights>;
  readonly frameOpacity: number | undefined;
  readonly marker?: string;
}

export function readThemeText(read: MermaidThemeText, over: ScaleBase = {}): ThemeText {
  const variables = themeVariablesFrom(read.variables, over);
  if (read.css === undefined) return { theme: read.theme, variables, weights: {}, frameOpacity: undefined };
  const { weights, colours, frameOpacity } = themeFromCss(read.css);
  const marker = colours.arrowheadColor;
  if (marker !== undefined) variables.arrowheadColor = marker;
  if (colours.lineColor !== undefined && variables.lineColor === undefined) variables.lineColor = colours.lineColor;
  for (const key of CSS_COLOURS) {
    if (colours[key] !== undefined && variables[key] === undefined) variables[key] = colours[key];
  }
  return { theme: read.theme, variables, weights, frameOpacity, ...markerOf(marker) };
}

// A list of colours, `plotColorPalette`, is read entry by entry.
const PALETTES: ReadonlySet<string> = new Set(["plotColorPalette"]);
const LIST_JOIN = ",";
// A value naming no colour is left out, as mermaid leaves an invalid colour unpainted.
const colourOf = (written: string): string | undefined => (themeRgb(written) === undefined ? undefined : cssColour(written));
// The variables that hold a width rather than a colour, read as numbers and never as a style.
const MEASURES: ReadonlySet<string> = new Set(["archEdgeWidth", "archGroupBorderWidth"]);
const spendable = (name: string, written: string): string | undefined => {
  if (MEASURES.has(name)) return written;
  if (!PALETTES.has(name)) return colourOf(written);
  const entries = written.split(LIST_JOIN).flatMap((entry) => colourOf(entry.trim()) ?? []);
  return entries.length === 0 ? undefined : entries.join(LIST_JOIN);
};

// The scale a `cScale3:` line writes into: the theme being dressed, never the bare one. mermaid states each band
// under its own key, so a name left unwritten keeps the colour the theme gives it.
export interface ScaleBase {
  readonly cScale?: readonly string[];
  readonly cScaleLabel?: readonly Ink[];
  readonly cScalePeer?: readonly Ink[];
  readonly cScaleInv?: readonly Ink[];
}

const USE_GRADIENT = "useGradient";

// A flag as mermaid tests it, truthy, off the scalar its YAML reader makes of the text: a `false`, a `null`, a zero,
// a NaN or nothing is off, and any other word is a string, on.
const FALSY_WORDS: ReadonlySet<string> = new Set(["", "~", "null", "Null", "NULL", "false", "False", "FALSE", ".nan", ".NaN", ".NAN"]);
const YAML_NUMBER = /^[-+]?(?:[0-9]+(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?|\.[0-9]+(?:[eE][-+]?[0-9]+)?|0x[0-9a-fA-F]+|0o[0-7]+|0b[01]+)$/u;
const flagged = (written: string): boolean => {
  const text = written.trim();
  return !FALSY_WORDS.has(text) && !(YAML_NUMBER.test(text) && Number(text.replace(/^[-+]/u, "")) === 0);
};

// mermaid reads `cScale0` to `cScale11` by their exact names, a seat's number with no sign, zero or trailing word.
const SEAT_RE = /^(?:0|[1-9]\d*)$/u;
const seatOf = (name: string, prefix: string): number | undefined => {
  const digits = name.slice(prefix.length);
  return name.startsWith(prefix) && SEAT_RE.test(digits) ? Number(digits) : undefined;
};

// The seated lists a `themeVariables` line writes one seat of.
const SEATED = ["cScale", "cScaleLabel", "cScalePeer", "cScaleInv"] as const;
const SEAT_PREFIXES: ReadonlyArray<readonly [prefix: string, list: (typeof SEATED)[number]]> = [
  [SCALE_PREFIX, "cScale"], [SCALE_LABEL_PREFIX, "cScaleLabel"], [SCALE_PEER_PREFIX, "cScalePeer"], [SCALE_INV_PREFIX, "cScaleInv"],
];
const SEATED_NAMES: ReadonlySet<string> = new Set(SEATED);

// A variable mermaid reads only inside its kind's own section of `themeVariables`, never at the top.
const NESTED_VARIABLES: ReadonlyMap<string, string> = new Map([
  ["xyChart.plotColorPalette", "plotColorPalette"],
  ["xyChart.titleColor", "xyTitleColor"],
  ["xyChart.dataLabelColor", "xyDataLabelColor"],
  ["xyChart.legendTextColor", "xyLegendTextColor"],
  ["xyChart.xAxisTitleColor", "xyXAxisTitleColor"],
  ["xyChart.xAxisLabelColor", "xyXAxisLabelColor"],
  ["xyChart.xAxisTickColor", "xyXAxisTickColor"],
  ["xyChart.xAxisLineColor", "xyXAxisLineColor"],
  ["xyChart.yAxisTitleColor", "xyYAxisTitleColor"],
  ["xyChart.yAxisLabelColor", "xyYAxisLabelColor"],
  ["xyChart.yAxisTickColor", "xyYAxisTickColor"],
  ["xyChart.yAxisLineColor", "xyYAxisLineColor"],
  ["packet.labelColor", "packetLabelColor"],
  ["packet.titleColor", "packetTitleColor"],
]);
const NESTED_ONLY: ReadonlySet<string> = new Set(NESTED_VARIABLES.values());
const variableNamed = (written: string): string | undefined =>
  NESTED_VARIABLES.get(written) ?? (NESTED_ONLY.has(written) ? undefined : written);

export function themeVariablesFrom(said: ReadonlyMap<string, string>, over: ScaleBase = {}): StatedVariables {
  const bare = derive({});
  const known = new Set(Object.keys(bare));
  const read: Record<string, unknown> = {};
  // With no theme under it, a band left unwritten is left to the theme file that derives it.
  const scale: Ink[] = over.cScale === undefined ? bare.cScale.map(() => undefined) : [...over.cScale];
  const sparse = (list: readonly Ink[] | undefined): Ink[] => Array.from({ length: scale.length }, (_, at) => list?.[at]);
  const lists = { cScale: scale, cScaleLabel: sparse(over.cScaleLabel), cScalePeer: sparse(over.cScalePeer), cScaleInv: sparse(over.cScaleInv) };
  const written = new Set<(typeof SEATED)[number]>();
  for (const [key, text] of said) {
    const name = variableNamed(key);
    if (name === undefined) continue;
    if (name === "darkMode" || name === USE_GRADIENT) {
      read[name] = flagged(text);
      continue;
    }
    const value = NO_COLOUR.has(text.toLowerCase()) ? BARE : spendable(name, text);
    if (value === undefined) continue;
    const seated = SEAT_PREFIXES.map(([prefix, list]) => [seatOf(name, prefix), list] as const).find(([at]) => at !== undefined);
    if (seated !== undefined) {
      const [at, list] = seated;
      if (at !== undefined && at < scale.length && value !== BARE) {
        lists[list][at] = value;
        written.add(list);
      }
      continue;
    }
    if (known.has(name) && !SEATED_NAMES.has(name)) read[name] = value;
  }
  for (const list of written) read[list] = lists[list];
  return read;
}


export function mermaidVariablesOf(theme: Theme, page: string): Record<string, string> {
  const out: Record<string, string> = { darkMode: String(theme.variables.darkMode) };
  const hexOf = (value: string): string => {
    const rgb = themeRgb(value);
    return rgb === undefined ? value : formatHex(rgb);
  };
  for (const [key, value] of Object.entries(theme.stated)) {
    if (key === "darkMode" || value === undefined || value === BARE) continue;
    if (Array.isArray(value)) {
      const prefix = SEAT_PREFIXES.find(([, list]) => list === key)?.[0];
      if (prefix !== undefined) {
        value.forEach((colour, at) => {
          if (typeof colour === "string") out[`${prefix}${at}`] = hexOf(colour);
        });
      }
    } else if (typeof value === "string") out[key] = hexOf(value);
  }
  for (const key of ["background", "mainBkg", "clusterBkg"] as const) out[key] ??= hexOf(page);  // keyword: mermaid's theme VARIABLES here, not the css property
  if (out.primaryTextColor === undefined && out.textColor !== undefined) out.primaryTextColor = out.textColor;
  return out;
}
