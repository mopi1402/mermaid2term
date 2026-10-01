import { MERMAID_THEME_NAMES, MERMAID_THEMES } from "./mermaid-themes.js";
import { CLASSIC_MERMAID_BLOCK } from "./classic.js";
import { must } from "../must.js";
import { makeTheme } from "./derive.js";
import { BARE, markerOf, type StatedVariables, type Theme, type ThemeSource, type ThemeWeights } from "./theme-model.js";
import { fromMermaidBlock } from "./themes.js";

// A palette of this page's own, not one mermaid wrote: its arrows, its tabs and its names keep the inks it names
// itself, where each mermaid theme carries a sequence ink of its own for every one of them.
const NO_SEQUENCE_INK: StatedVariables = {
  actorTextColor: BARE,
  labelBoxBkgColor: BARE,
  labelBoxBorderColor: BARE,
  labelTextColor: BARE,
  loopTextColor: BARE,
  sequenceNumberColor: BARE,
  signalColor: BARE,
  signalTextColor: BARE,
};

// A palette of this page's own strokes its participants in its node border too, where mermaid derives `actorBorder`
// from `primaryBorderColor`.
const bordered = (ink: string): StatedVariables => ({ nodeBorder: ink, actorBorder: ink });

// What a palette of this page's own keeps where it names nothing: a dark page, the terminal's own ink for every fill,
// band and rim `theme-base.js` derives off the primary colour, and a note slab and gantt bars of its own.
export const HOUSE: StatedVariables = {
  darkMode: true,
  primaryTextColor: BARE,
  mainBkg: BARE,
  clusterBkg: BARE,
  rowOdd: BARE,
  rowEven: BARE,
  activationBkgColor: BARE,
  activationBorderColor: BARE,
  noteBkgColor: "#FFD633",
  noteTextColor: "#1A1A1A",
  gridColor: BARE,
  vertLineColor: BARE,
  doneTaskBkgColor: "#808080",
  critBkgColor: "#E5484D",
  todayLineColor: "#E5484D",
  sectionBkgColor: BARE,
  altSectionBkgColor: BARE,
  sectionBkgColor2: BARE,
  excludeBkgColor: BARE,
  taskBorderColor: BARE,
  activeTaskBorderColor: BARE,
  doneTaskBorderColor: BARE,
  critBorderColor: BARE,
  taskTextClickableColor: BARE,
};

const house = (source: ThemeSource): Theme => makeTheme({ ...source, variables: { ...HOUSE, ...source.variables } });

// What every coloured palette of this page's own adds: its own sequence inks, no edge label ground, no lifeline ink,
// and the `neo` look's gradient, from mermaid's own pair: the primary border to the secondary one.
const COLOURED: StatedVariables = { ...NO_SEQUENCE_INK, useGradient: true, edgeLabelBackground: BARE, actorLineColor: BARE };

const coloured = (source: ThemeSource): Theme => house({ ...source, variables: { ...COLOURED, ...source.variables } });

export const THEMES: ReadonlyMap<string, Theme> = new Map(
  (
    [
      house({
        name: "mono",
        variables: {
          // One grey a slice, light and dark by turns so two neighbours never blend.
          pie1: "#EEEEEE", pie2: "#797979", pie3: "#C7C7C7", pie4: "#5F5F5F", pie5: "#E1E1E1", pie6: "#939393",
          pie7: "#6C6C6C", pie8: "#D4D4D4", pie9: "#868686", pie10: "#BABABA", pie11: "#A0A0A0", pie12: "#ADADAD",
          plotColorPalette: "#EEEEEE,#797979,#C7C7C7,#5F5F5F,#E1E1E1,#939393,#6C6C6C,#D4D4D4,#868686,#BABABA",
          altBackground: BARE,
          ...NO_SEQUENCE_INK,
          edgeLabelBackground: BARE,
          cScale: ["#1A1A1A", "#303030", "#242424", "#383838", "#202020", "#343434", "#282828", "#2C2C2C", "#1E1E1E", "#323232", "#262626", "#3A3A3A"],
          critBkgColor: BARE,
          doneTaskBkgColor: BARE,
          todayLineColor: BARE,
          noteBkgColor: BARE,
          noteTextColor: BARE,
          noteBorderColor: BARE,
          gradientStart: "#D0D0D0",
          gradientStop: "#707070",
        },
        weights: { node: "bold", edge: "dim", subgraph: "dim", label: "", edgeLabel: "italic dim" },
      }),
      fromMermaidBlock("classic", CLASSIC_MERMAID_BLOCK, HOUSE),
      coloured({
        name: "terra",
        variables: {
          altBackground: BARE,
          // Halfway between mermaid's pair and the theme's border to its secondary: mermaid's alone washes this one out.
          gradientStart: "#C9987E",
          gradientStop: "#987EC9",
          primaryColor: "#D4845A",
          ...bordered("#D4845A"),
          lineColor: "#8B7E6A",
          arrowheadColor: "#E8A87C",
          textColor: "#F5E6D3",
          m2t_edgeLabelColor: "#B89A7A",
          clusterBorder: "#A07858",
          titleColor: "#E8A87C",
          cScale: ["#502010", "#104820", "#504008", "#0E2850", "#401038", "#084840", "#503008", "#201050", "#2C4B0D", "#4B0D22", "#360D4B", "#124B0D"],
        },
        weights: { node: "bold", label: "" },
      }),
      coloured({
        name: "neon",
        variables: {
          altBackground: BARE,
          primaryColor: "magenta",
          ...bordered("magenta"),
          lineColor: "cyan",
          arrowheadColor: "green",
          textColor: "white",
          m2t_edgeLabelColor: "cyan",
          clusterBorder: "magenta",
          titleColor: "cyan",
          cScale: ["#0A1050", "#500A18", "#0A500A", "#50400A", "#400A50", "#0A5040", "#502A0A", "#1A0A50", "#33500A", "#0A3950", "#500A3F", "#0A5027"],
        },
        weights: { node: "bold", edge: "dim", subgraph: "dim" },
      }),
      coloured({
        name: "amber",
        variables: {
          altBackground: BARE,
          primaryColor: "#FFB000",
          ...bordered("#FFB000"),
          lineColor: "#806000",
          arrowheadColor: "#FFD080",
          textColor: "#FFD580",
          m2t_edgeLabelColor: "#B08030",
          clusterBorder: "#906800",
          titleColor: "#FFC040",
          cScale: ["#50300A", "#0A2850", "#285008", "#500A28", "#280A50", "#0A5038", "#502008", "#0A1050", "#500A50", "#0A5010", "#4A500A", "#0A4A50"],
        },
        weights: { node: "bold", label: "" },
      }),
      coloured({
        name: "phosphor",
        variables: {
          altBackground: BARE,
          primaryColor: "#33FF33",
          ...bordered("#33FF33"),
          lineColor: "#1A8C1A",
          arrowheadColor: "#66FF66",
          textColor: "#AAFFAA",
          m2t_edgeLabelColor: "#339933",
          clusterBorder: "#228B22",
          titleColor: "#55DD55",
          cScale: ["#083008", "#0A4808", "#081850", "#484808", "#081850", "#084830", "#480808", "#180850", "#480843", "#083D48", "#482808", "#284808"],
        },
        weights: { node: "bold", label: "" },
      }),
      coloured({
        name: "gruvbox",
        variables: {
          background: "#282828",
          primaryColor: "#FABD2F",
          ...bordered("#FABD2F"),
          mainBkg: "#3C3836",
          lineColor: "#8EC07C",
          arrowheadColor: "#FE8019",
          textColor: "#EBDBB2",
          m2t_edgeLabelColor: "#D5C4A1",
          clusterBorder: "#B8BB26",
          clusterBkg: "#32302F",
          altBackground: "#32302F",
          titleColor: "#D5C4A1",
          cScale: ["#502010", "#085020", "#504008", "#082850", "#48082A", "#085048", "#502808", "#180850", "#265008", "#440850", "#445008", "#500814"],
        },
      }),
      coloured({
        name: "monokai",
        variables: {
          background: "#272822",
          primaryColor: "#F92672",
          ...bordered("#F92672"),
          mainBkg: "#3E3D32",
          lineColor: "#66D9EF",
          arrowheadColor: "#A6E22E",
          textColor: "#F8F8F2",
          m2t_edgeLabelColor: "#E6DB74",
          clusterBorder: "#AE81FF",
          clusterBkg: "#333328",
          altBackground: "#333328",
          titleColor: "#AE81FF",
          cScale: ["#50102A", "#085040", "#405008", "#380850", "#085038", "#502A08", "#081850", "#501010", "#0E5008", "#083E50", "#500844", "#1A0850"],
        },
      }),
      coloured({
        name: "dracula",
        variables: {
          // Halfway, as terra: mermaid's pair alone is all but white on this one.
          gradientStart: "#CDB1F4",
          gradientStop: "#B1F4CD",
          background: "#282A36",
          primaryColor: "#BD93F9",
          ...bordered("#BD93F9"),
          mainBkg: "#44475A",
          lineColor: "#6272A4",
          arrowheadColor: "#50FA7B",
          textColor: "#F8F8F2",
          m2t_edgeLabelColor: "#8BE9FD",
          clusterBorder: "#FF79C6",
          clusterBkg: "#383A4A",
          altBackground: "#383A4A",
          titleColor: "#FF79C6",
          cScale: ["#2A1040", "#0E4028", "#40380A", "#102A40", "#3C0A24", "#0A403A", "#402010", "#1A1040", "#1F420E", "#420E42", "#0E4213", "#420E13"],
        },
      }),
      coloured({
        name: "nord",
        variables: {
          // Halfway, as terra: mermaid's pair alone is all but white on this one.
          gradientStart: "#A6C3CB",
          gradientStop: "#C3CBA6",
          background: "#2E3440",
          primaryColor: "#88C0D0",
          ...bordered("#88C0D0"),
          mainBkg: "#3B4252",
          lineColor: "#4C566A",
          arrowheadColor: "#A3BE8C",
          textColor: "#ECEFF4",
          m2t_edgeLabelColor: "#B48EAD",
          clusterBorder: "#81A1C1",
          clusterBkg: "#343C4A",
          altBackground: "#343C4A",
          titleColor: "#81A1C1",
          cScale: ["#143858", "#0A5830", "#501848", "#584810", "#48100A", "#581020", "#2A5010", "#381058", "#101058", "#105858", "#105810", "#4C5810"],
        },
      }),
      coloured({
        name: "solarized",
        variables: {
          background: "#002B36",
          primaryColor: "#268BD2",
          ...bordered("#268BD2"),
          mainBkg: "#073642",
          lineColor: "#586E75",
          arrowheadColor: "#B58900",
          textColor: "#FDF6E3",
          m2t_edgeLabelColor: "#CB4B16",
          clusterBorder: "#2AA198",
          clusterBkg: "#053440",
          altBackground: "#053440",
          titleColor: "#2AA198",
          cScale: ["#0A3048", "#0A4820", "#380A38", "#483808", "#08403A", "#480A20", "#2A4008", "#100A48", "#48140A", "#14480A", "#2E0A48", "#0A1948"],
        },
      }),
      ...MERMAID_THEMES.map(makeTheme),
    ] satisfies Theme[]
  ).map((theme) => [theme.name, theme])
);

export const DEFAULT_THEME = "mono";

export function getTheme(
  name: string | Theme,
  overrides?: StatedVariables,
  weights?: Partial<ThemeWeights>,
  frameOpacity?: number,
  marker?: string
): Theme {
  const theme =
    typeof name === "string" ? THEMES.get(name) ?? (must(THEMES.get(DEFAULT_THEME))) : name;
  const recolour = overrides !== undefined && Object.keys(overrides).length > 0;
  const reweigh = weights !== undefined && Object.keys(weights).length > 0;
  if (!recolour && !reweigh && frameOpacity === undefined && marker === undefined) return theme;
  const own = theme.variables.cScaleLabel;
  const written = overrides?.cScaleLabel ?? [];
  const named = new Set(theme.namedLabels);
  written.forEach((label, at) => {
    if (label !== undefined && label !== own[at]) named.add(at);
  });
  // A mermaid theme replays its file over what the source writes; a palette of this page's own is restated.
  return makeTheme({
    name: theme.name,
    namedLabels: named,
    written: new Set([...theme.written, ...Object.keys(overrides ?? {})]),
    variables: MERMAID_THEME_NAMES.includes(theme.name) ? (overrides ?? {}) : { ...theme.stated, ...overrides },
    weights: { ...theme.weights, ...weights },
    frameOpacity: frameOpacity ?? theme.frameOpacity,
    lifelineWidth: theme.lifelineWidth,
    ...markerOf(marker ?? theme.marker),
  });
}
