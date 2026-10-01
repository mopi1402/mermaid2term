import { inkedStyle } from "../../colour/contrast.js";
import { fontWordsOf, PROP_COLOR, PROP_FILL, PROP_STROKE } from "../../source/css.js";
import { colourToHex } from "../../colour/colours.js";
import { withFont } from "../mix.js";
import { readCssRules } from "../css-rules.js";
import { ARCHITECTURE_SELECTORS } from "./architecture.js";
import { grounded } from "../style.js";
import { BOLD, ITALIC } from "../tokens.js";
import { BLOCK_SELECTORS } from "./block.js";
import { CLASS_SELECTORS } from "./class.js";
import { ER_SELECTORS } from "./er.js";
import { FLOWCHART_SELECTORS } from "./flowchart.js";
import { GANTT_SELECTORS } from "./gantt.js";
import { GITGRAPH_SELECTORS } from "./gitgraph.js";
import { JOURNEY_SELECTORS } from "./journey.js";
import { KANBAN_SELECTORS } from "./kanban.js";
import { MINDMAP_SELECTORS } from "./mindmap.js";
import { PACKET_SELECTORS } from "./packet.js";
import { PIE_SELECTORS } from "./pie.js";
import { QUADRANT_SELECTORS } from "./quadrant.js";
import { SEQUENCE_SELECTORS } from "./sequence.js";
import { STATE_SELECTORS } from "./state.js";
import { TIMELINE_SELECTORS } from "./timeline.js";
import { TREEMAP_SELECTORS } from "./treemap.js";
import { XY_CHART_SELECTORS } from "./xychart.js";
import { type KindSelector, type Restyle, type Unread } from "./model.js";

const TABLES: ReadonlyMap<string, readonly KindSelector[]> = new Map([
  ["block", BLOCK_SELECTORS],
  ["architecture", ARCHITECTURE_SELECTORS],
  ["class", CLASS_SELECTORS],
  ["er", ER_SELECTORS],
  ["flowchart", FLOWCHART_SELECTORS],
  ["gantt", GANTT_SELECTORS],
  ["gitGraph", GITGRAPH_SELECTORS],
  ["journey", JOURNEY_SELECTORS],
  ["kanban", KANBAN_SELECTORS],
  ["mindmap", MINDMAP_SELECTORS],
  ["packet", PACKET_SELECTORS],
  ["pie", PIE_SELECTORS],
  ["quadrantChart", QUADRANT_SELECTORS],
  ["sequence", SEQUENCE_SELECTORS],
  ["state", STATE_SELECTORS],
  ["timeline", TIMELINE_SELECTORS],
  ["treemap", TREEMAP_SELECTORS],
  ["xyChart", XY_CHART_SELECTORS],
]);

// The rules a source's `themeCSS` writes for its kind's own selectors, in the order the CSS writes them.
export function cssRestyles(section: string, css: string | undefined): Restyle[] {
  const table = TABLES.get(section);
  if (table === undefined || css === undefined) return [];
  const restyles: Restyle[] = [];
  for (const [selector, props] of readCssRules(css)) {
    for (const reached of table.filter((entry) => entry.selectors.includes(selector))) {
      const unread = new Set(reached.unread ?? []);
      const read = (prop: string, channel: Unread): string | undefined => (unread.has(channel) ? undefined : colourToHex(props.get(prop) ?? ""));
      const fill = read(PROP_FILL, "fill");
      const drawn = reached.fill === "ink" ? fill : undefined;
      const ink = read(PROP_COLOR, "color") ?? drawn ?? (reached.fill === "html" ? undefined : read(PROP_STROKE, "stroke"));
      const words = unread.has("font") ? [] : fontWordsOf(props).filter((word) => !(unread.has("bold") && word === BOLD) && !(unread.has("italic") && word === ITALIC));
      restyles.push({ keys: reached.keys, ink, ground: reached.fill === "ground" ? fill : undefined, words });
    }
  }
  return restyles;
}

// Each palette entry a rule reaches, its ink, its ground and its font laid over what the theme gave it.
export function restyled(styleMap: Map<string, string>, restyles: readonly Restyle[]): void {
  if (restyles.length === 0) return;
  for (const [key, style] of styleMap) {
    let said = style;
    for (const restyle of restyles.filter((r) => r.keys(key))) {
      if (restyle.ink !== undefined) said = inkedStyle(said, restyle.ink);
      if (restyle.ground !== undefined) said = grounded(said, restyle.ground);
      said = withFont(said, restyle.words);
    }
    styleMap.set(key, said);
  }
}
