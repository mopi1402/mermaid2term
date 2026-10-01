import { inkedStyle } from "../colour/contrast.js";
import { cssColour, themeRgb } from "../colour/colours.js";
import { darken, lighten } from "../colour/palette.js";
import { formatHex } from "../colour/rgb.js";
import { inked } from "./style.js";
import { plainLabel } from "./labels.js";
import { labelsOf } from "./css-labels.js";
import { readCssRules } from "./css-rules.js";
import { colorSlotsOf } from "./color-slots.js";
import { COLUMNS_READ } from "./themecss/kanban.js";
import { CLASS_SECTION, NEO_LOOK } from "../source/source.js";
import { MERMAID_THEME_NAMES } from "./mermaid-themes.js";
import { textOnPage } from "./sections.js";
import { COLOR_THEMES, DARK_THEMES, OWN_FALLBACKS, REDUX_THEMES, type FallingInk, type Theme, type ThemeVariables } from "./theme-model.js";

type OwnInk = FallingInk | "classText" | "nodeTextColor";

// A kind's own variable the theme or the source states, or else the generic one mermaid derives it from, read as the
// ground left it: a derived value turned for the page would not be the one its generic source was turned into.
const stated = (th: Theme, own: OwnInk, generic: keyof ThemeVariables): string | undefined => {
  const value = th.stated[own] === undefined ? th.variables[generic] : th.variables[own];
  return typeof value === "string" ? value : undefined;
};

const statedOwn = (th: Theme, own: FallingInk): string | undefined => stated(th, own, OWN_FALLBACKS[own]);

// A graph's heads, its edges' labels and its title as the kind's stylesheet inks them: the heads on the `.marker`
// rule's `lineColor` (never `arrowheadColor`, which only a legacy `.arrowheadPath` reads), the title on the page's
// `textColor`, which the SVG's own fill gives every title these kinds draw.
const graphInks = (th: Theme, heads: string | undefined, labels: string | undefined): Theme => ({
  ...th,
  arrow: inked(th.weights.arrow, heads),
  edgeLabel: inked(th.weights.edgeLabel, labels),
  heading: inked(th.weights.label, th.variables.textColor),
});

// mermaid's `stateDiagram` stylesheet reads its own variables before the generic ones: `stateBkg || mainBkg` under a
// state, `stateBorder || nodeBorder` round it and round a composite, `transitionColor` on its lines and heads,
// `stateLabelColor` on its names and a composite's title, `transitionLabelColor` on a transition's label.
function stateTheme(th: Theme): Theme {
  const w = th.weights;
  const border = statedOwn(th, "stateBorder");
  const line = statedOwn(th, "transitionColor");
  const name = statedOwn(th, "stateLabelColor") ?? th.variables.textColor;
  return {
    ...graphInks(th, line, statedOwn(th, "transitionLabelColor")),
    node: th.stated.stateBorder === undefined ? th.node : inked(w.node, border),
    edge: th.stated.transitionColor === undefined ? th.edge : inked(w.edge, line),
    label: inked(w.label, name),
    subgraphLabel: inked(w.subgraphLabel, name),
    variables: { ...th.variables, mainBkg: th.stated.stateBkg === undefined ? th.variables.mainBkg : th.variables.stateBkg },
  };
}

// mermaid's journey stylesheet fills a section and its tasks with `fillType<N>`, never with `cScale`, the section
// counted over the seven `sectionFills` so `fillType7` never shows; the `hsl()` of `neo` and `redux` is read as CSS,
// a colour the terminal reads kept as written. Its `line { stroke: textColor }` draws the axis.
function journeyTheme(th: Theme): Theme {
  const v = th.variables;
  const lined = v.textColor === undefined ? th : { ...th, edge: inked(th.weights.edge, v.textColor) };
  const fills = [v.fillType0, v.fillType1, v.fillType2, v.fillType3, v.fillType4, v.fillType5, v.fillType6].map(cssColour);
  const known = fills.filter((fill): fill is string => fill !== undefined);
  return known.length === fills.length ? { ...lined, sectionColors: known } : lined;
}

// mermaid's timeline stylesheet draws every `.lineWrapper` line, the axis and its connectors, in the last seat's
// `cScaleLabel11`, the arrowhead left on the text colour it inherits.
const LAST_LABEL_SEAT = 11;
function lineWrapperTheme(th: Theme): Theme {
  const v = th.variables;
  const axis = v.cScaleLabel[LAST_LABEL_SEAT];
  if (axis === undefined) return th;
  return { ...th, edge: inked(th.weights.edge, axis), arrow: v.textColor === undefined ? th.arrow : inked(th.weights.arrow, v.textColor) };
}

// mermaid's redux timeline stylesheet strokes every section `nodeBorder`, a colour pack's in its `borderColorArray`
// seat, never `cScale`, fills it `mainBkg` but on `redux-color`, writes every name and event and draws every
// `.lineWrapper` line in `nodeBorder`, the arrowhead left on the text colour it inherits.
function timelineTheme(th: Theme): Theme {
  const v = th.variables;
  const w = th.weights;
  if (!REDUX_THEMES.has(th.name)) return lineWrapperTheme(th);
  if (v.nodeBorder === undefined) return th;
  const border = v.nodeBorder;
  const palette = colorSlotsOf(th)?.border;
  const seats = palette ?? th.sectionColors.map(() => border);
  const ground = v.mainBkg;
  const filled = palette !== undefined && !DARK_THEMES.has(th.name);
  return {
    ...th,
    sectionColors: seats,
    ...(filled || ground === undefined ? {} : { sectionGrounds: seats.map(() => ground) }),
    variables: { ...v, cScaleLabel: seats.map(() => border) },
    edge: inked(w.edge, border),
    arrow: v.textColor === undefined ? th.arrow : inked(w.arrow, v.textColor),
  };
}

// mermaid's kanban stylesheet fills column N with `cScale<N+1>` lightened by 10, darkened in dark mode, up to its
// `THEME_COLOR_LIMIT`; a column past it shows the SVG's own `textColor` fill. Every title and card is `textColor`.
const KANBAN_SEAT_SHIFT = 2;
const KANBAN_SHADE = 10;
function kanbanTheme(th: Theme): Theme {
  const v = th.variables;
  const shaded = th.sectionColors.slice(KANBAN_SEAT_SHIFT).map((c) => {
    const rgb = themeRgb(c);
    return rgb === undefined ? c : formatHex(v.darkMode ? darken(rgb, KANBAN_SHADE) : lighten(rgb, KANBAN_SHADE));
  });
  const past = cssColour(v.textColor);
  const seats = past === undefined ? shaded : [...shaded, ...Array.from({ length: Math.max(0, COLUMNS_READ - shaded.length) }, () => past)];
  if (seats.length === 0) return th;
  return {
    ...th,
    sectionColors: seats,
    namedLabels: new Set(),
    variables: { ...v, cScaleLabel: seats.map(() => v.textColor) },
  };
}

// The flowchart, ER and block stylesheets ink a node's label and an edge's `nodeTextColor || textColor`; a flowchart's
// heads take a themeCSS `.marker` over the line, which a class, ER or block head's own rule never lets through.
const nodeTextTheme = (th: Theme): Theme => {
  const words = stated(th, "nodeTextColor", "textColor");
  const turned = graphInks(th, th.variables.lineColor, words);
  return th.stated.nodeTextColor === undefined ? turned : { ...turned, label: inked(th.weights.label, words) };
};
const flowchartTheme = (th: Theme): Theme => (th.marker === undefined ? th : { ...th, arrow: inked(th.weights.arrow, th.marker) });

// A class box's text and a relation's label and multiplicities are `classText`, which mermaid's themes derive from
// `primaryTextColor`.
const classTheme = (th: Theme): Theme => {
  const words = stated(th, "classText", "primaryTextColor") ?? th.variables.textColor;
  return { ...graphInks(th, th.variables.lineColor, words), label: inked(th.weights.label, words) };
};

// mermaid's ER stylesheet grounds a relationship's label on `erEdgeLabelBackground` under these two themes alone.
const erLabelTheme = (th: Theme): Theme =>
  !COLOR_THEMES.has(th.name) || th.variables.erEdgeLabelBackground === undefined ? th : { ...th, variables: { ...th.variables, edgeLabelBackground: th.variables.erEdgeLabelBackground } };

// mermaid's architecture stylesheet: `.edge` on `archEdgeColor`, `.arrow` on `archEdgeArrowColor`, a group's
// `.node-bkg` on `archGroupBorderColor`, each off the line or the primary border when unwritten, the head and the
// frame included; `.node-bkg` fills nothing, whatever `clusterBkg` says; a group's title is on `textColor`.
function architectureTheme(th: Theme): Theme {
  const w = th.weights;
  const own = (name: FallingInk, weight: string, fallback: string): string => {
    const ink = statedOwn(th, name);
    return ink === undefined ? fallback : inked(weight, ink);
  };
  return {
    ...th,
    edge: own("archEdgeColor", w.edge, th.edge),
    arrow: own("archEdgeArrowColor", w.arrow, th.arrow),
    subgraph: own("archGroupBorderColor", w.subgraph, th.subgraph),
    subgraphLabel: inked(w.subgraphLabel, th.variables.textColor),
    variables: { ...th.variables, clusterBkg: undefined },
  };
}

// mermaid's treemap writes its title, the frontmatter one too, in `titleColor`, the theme's or the source's.
const titleTheme = (th: Theme): Theme =>
  th.stated.titleColor === undefined || th.variables.titleColor === undefined ? th : { ...th, label: inked(th.weights.label, th.variables.titleColor) };

// mermaid's packet stylesheet inks a field's name `packet.labelColor` and the title `packet.titleColor`, the
// frontmatter one too, as the source writes them; unwritten, `black` (`defaultPacketStyleOptions`), but on `dark` and
// `forest`, whose `updateColors` state their `primaryTextColor`, weighed to read on the page.
const PACKET_OWN_TEXT: ReadonlySet<string> = new Set(["dark", "forest"]);
const PACKET_DEFAULT_INK = "black";
function packetTheme(th: Theme): Theme {
  const { packetLabelColor, packetTitleColor, primaryTextColor } = th.variables;
  const unwritten = !MERMAID_THEME_NAMES.includes(th.name)
    ? undefined
    : PACKET_OWN_TEXT.has(th.name) ? primaryTextColor : PACKET_DEFAULT_INK;
  const ink = (written: string | undefined): string =>
    written !== undefined ? inked(th.weights.label, written) : (textOnPage(th, unwritten, th.weights.label) ?? th.label);
  return { ...th, label: ink(packetLabelColor), heading: ink(packetTitleColor) };
}

const VIEWS: ReadonlyMap<string, ReadonlyArray<(th: Theme) => Theme>> = new Map([
  ["state", [stateTheme]],
  ["journey", [journeyTheme]],
  ["timeline", [timelineTheme]],
  [CLASS_SECTION, [classTheme]],
  ["flowchart", [nodeTextTheme, flowchartTheme]],
  ["er", [nodeTextTheme, erLabelTheme]],
  ["block", [nodeTextTheme]],
  ["architecture", [architectureTheme]],
  ["kanban", [kanbanTheme]],
  ["treemap", [titleTheme]],
  ["packet", [packetTheme]],
]);

// The theme as a kind's own stylesheet reads it: each kind's variables laid over the generic ones they stand for.
export const sectionTheme = (th: Theme, section: string): Theme => (VIEWS.get(section) ?? []).reduce((turned, view) => view(turned), th);

// mermaid's class stylesheet grounds a relation's label on `mainBkg` (`.edgeLabel .label span`), and on
// `edgeLabelBackground` under the `neo` look alone (`.edgeLabel[data-look="neo"]`).
export const lookedTheme = (th: Theme, section: string, look: string | undefined): Theme =>
  section !== CLASS_SECTION || look === NEO_LOOK ? th : { ...th, variables: { ...th.variables, edgeLabelBackground: th.variables.mainBkg } };

// A `themeCSS` colour on the label selectors lies on the words themselves, over every variable the kind's own sheet
// inks them with; a node's `classDef` or `style` colour still wins, laid on it at paint. An edge chip keeps its words.
export function cssLabelled(th: Theme, css: string | undefined, section: string): Theme {
  if (css === undefined) return th;
  const { label, edgeLabel, edgeLabelGround, subgraphLabel } = labelsOf(readCssRules(css), section);
  if (label === undefined && edgeLabel === undefined && edgeLabelGround === undefined) return th;
  const chip = plainLabel(th);
  return {
    ...th,
    label: label === undefined ? th.label : inkedStyle(th.label, label),
    edgeLabel: edgeLabel === undefined ? th.edgeLabel : inkedStyle(th.edgeLabel, edgeLabel),
    subgraphLabel: subgraphLabel === undefined ? th.subgraphLabel : inkedStyle(th.subgraphLabel, subgraphLabel),
    chipLabel: edgeLabel === undefined ? chip : inkedStyle(chip, edgeLabel),
    variables: edgeLabelGround === undefined ? th.variables : { ...th.variables, edgeLabelBackground: edgeLabelGround },
  };
}

// The start dot and a fork or join bar take `specialStateColor`, the end state's disc `innerEndBackground`.
export const specialStateInk = (th: Theme): string => inked(th.weights.node, statedOwn(th, "specialStateColor"));
export const endStateInk = (th: Theme): string => inked(th.weights.node, statedOwn(th, "innerEndBackground"));
