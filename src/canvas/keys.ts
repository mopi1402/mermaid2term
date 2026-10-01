export const COMPOSITE = "@";
const INDEX_MARK = ":";

export const NODE = "node";
export const EDGE = "edge";
export const ARROW = "arrow";
export const SUBGRAPH = "subgraph";
export const COMPOSITE_FRAME = "subgraph_composite";
// mermaid draws a composite state as TWO rects: the outer one, which the name's band stands on, takes
// `compositeTitleBackground`; the inner one, below the divider, takes the composite's own body colour
// (`.statediagram-cluster rect` and `.statediagram-cluster .inner`, `state/styles.js`).
const COMPOSITE_TITLE = "composite_title";
export const SUBGRAPH_LABEL = "subgraph_label";
export const LABEL = "label";
export const EDGE_LABEL = "edge_label";
export const DEFAULT_STYLE = "default";
export const MARKER = "marker";
export const FAINT = "faint";
export const NODE_FAINT = "node_faint";
export const BOLD_LABEL = "bold_label";
export const PLAIN_LABEL = "plain_label";
export const ITALIC_LABEL = "italic_label";
const LABEL_KEYS = [LABEL, BOLD_LABEL, ITALIC_LABEL, PLAIN_LABEL];
// Whether a cell's key is a box's words, whatever weight they stand in.
export const wordKey = (key: string): boolean => LABEL_KEYS.some((label) => key.startsWith(label));
export const ACTIVE = "active";
export const ACTIVE_MARK = "active_mark";
// A bar and its stacked count, seated on the participant they stand on.
export const ACTIVE_INDEXED = ACTIVE + INDEX_MARK;
export const ACTIVE_MARK_INDEXED = ACTIVE_MARK + INDEX_MARK;
export const FRAME = "frame";
export const FRAME_TAB = "frame_tab";
// A sequence's own inks, which mermaid keeps apart from every other kind's: `.messageLine0`, `[id$=-arrowhead]`,
// `.messageText`, `.loopLine`, `.labelBox` with `.labelText`, and `.sectionTitle` (`sequenceDiagram`'s stylesheet).
export const SIGNAL = "signal";
export const SIGNAL_LINE = "signal_line";
export const SIGNAL_LABEL = "signal_label";
export const LOOP_LINE = "loop_line";
export const LABEL_BOX = "label_box";
export const LOOP_LABEL = "loop_label";
export const ACTOR = "actor";
export const LIFELINE = "lifeline";
export const NOTE = "note";
export const BOX = "box";
export const BOX_LABEL = "box_label";
export const STRIPE = "stripe";
export const GRID = "grid";
export const RULE = "rule";
export const CRIT = "crit";
export const TASK_DONE = "task_done";
export const TASK_ACTIVE = "task_active";
export const TODAY = "today";

const tailed = (name: string): string => COMPOSITE + name;

export const FILL_TAIL = tailed("fill");
const LABEL_TAIL = tailed("label");
export const CHIP_TAIL = tailed("chip");
// A chip keeps its tail under the ground it is laid on, `edge_label@chip@cluster`.
export const isChip = (key: string): boolean => key.includes(CHIP_TAIL);
export const OUT_TAIL = tailed("out");
export const RIM_TAIL = tailed("rim");
// A frame's wall standing on the frame's own ground, where `@rim` is a box's wall on the box's fill.
export const WALL_TAIL = tailed("wall");
export const SLAB_TAIL = tailed("slab");
export const NOTCH_TAIL = tailed("notch");
// The sign that names a circle or a rhombus drawn as a box, standing on the box's own fill.
export const MARK_TAIL = tailed("mark");
// The faint rule a folded group draws inside itself, standing on the box's own fill.
export const FOLD_TAIL = tailed("fold");
export const CLUSTER_TAIL = tailed("cluster");
export const TITLE_TAIL = tailed("title");
// A composite state's body, and one nested a level down: mermaid alternates the two from one `doc` to the next.
export const BODY_TAIL = tailed("body");
export const ALT_TAIL = tailed("alt");
const STRIPE_TAIL = tailed("stripe");
const ABSTRACT_TAIL = tailed("abstract");
const STATIC_TAIL = tailed("static");

export const BAND_MARK = tailed("bg:");
export const INK_MARK = tailed("ink:");
// A key with its ink taken apart, the ink kept to put back behind whatever replaces the tail.
export const inkApart = (key: string): readonly [string, string] => {
  const at = key.lastIndexOf(INK_MARK);
  return at === -1 ? [key, ""] : [key.slice(0, at), key.slice(at)];
};
// A key with its band taken apart, the band keeping its mark, '' when the key has none.
export const bandApart = (key: string): readonly [base: string, band: string] => {
  const at = key.lastIndexOf(BAND_MARK);
  return at === -1 ? [key, ""] : [key.slice(0, at), key.slice(at)];
};
// The box a border cell belongs to, `node@grad:3`: the `neo` look inks it by its column across that box once the
// drawing is final, so the mark is the same on every column of a box and compaction folds it as it folded the key.
const GRADIENT_MARK = tailed("grad:");

// Laid before a band, the painter reading `@bg:` last.
export const gradientMarked = (key: string, box: number): string => {
  const [base, band] = bandApart(key);
  return `${base}${GRADIENT_MARK}${box}${band}`;
};

// The key a mark was laid on, as every pass that reads keys before the painter knows it.
export const unmarked = (key: string): string => {
  const marked = gradientOff(key);
  return marked === undefined ? key : marked.before + marked.after;
};

// The box a key was marked with, and the key around it, the mark taken out.
export const gradientOff = (key: string): { readonly box: number; readonly before: string; readonly after: string } | undefined => {
  const at = key.lastIndexOf(GRADIENT_MARK);
  if (at === -1) return undefined;
  const rest = key.slice(at + GRADIENT_MARK.length);
  const digits = /^\d+/u.exec(rest)?.[0] ?? "";
  return { box: Number(digits), before: key.slice(0, at), after: rest.slice(digits.length) };
};

// A weight laid OVER whatever key precedes it, the way `@ink:` lays a colour over one: a bold word inside a
// note keeps the note's ground, where swapping the key for a bare `bold_label` left it on the page's own.
export const BOLD_MARK = tailed("bold");
export const ITALIC_MARK = tailed("italic");
// The font a node's CSS asks of its text, `@font:bold+underline`, laid before its ink and added to what the key says.
export const FONT_MARK = tailed("font:");
export const FONT_JOIN = "+";
// How much of a node shows, `@fade:0.4/0.2`: its lines and words, then its ground, mixed with the page at paint.
export const FADE_MARK = tailed("fade:");
export const FADE_JOIN = "/";
// The third part of a fade on a word: it lies on the node's ground, not on the page.
export const FADE_WORDS = "w";

// A quadrant chart's own inks: each quadrant's ground, its name, a point and its label on it, then the axes, the
// frame, the title and the two axis labels.
export const QUADRANT_PREFIX = "quadrant_";
export const QUADRANT_FILL = `${QUADRANT_PREFIX}fill_`;
export const QUADRANT_TEXT = `${QUADRANT_PREFIX}text_`;
export const QUADRANT_POINT = `${QUADRANT_PREFIX}point_`;
export const QUADRANT_POINT_TEXT = `${QUADRANT_PREFIX}point_text_`;
export const QUADRANT_AXIS = `${QUADRANT_PREFIX}axis`;
export const QUADRANT_BORDER = `${QUADRANT_PREFIX}border`;
export const QUADRANT_TITLE = `${QUADRANT_PREFIX}title`;
export const QUADRANT_X_LABEL = `${QUADRANT_PREFIX}x_label`;
export const QUADRANT_Y_LABEL = `${QUADRANT_PREFIX}y_label`;

// An xychart's own inks: the title, every axis text, the axis lines and ticks, and one per plot in source order.
const XY_PREFIX = "xychart_";
export const XY_TITLE = `${XY_PREFIX}title`;
// An axis's four parts, each inked by its own theme variable as mermaid's `xAxisTitleColor` and its siblings: the
// category axis is x, the value axis y, whichever way the chart lies.
export interface XyAxisKeys {
  readonly title: string;
  readonly label: string;
  readonly tick: string;
  readonly line: string;
}
const axisKeys = (axis: string): XyAxisKeys => ({
  title: `${XY_PREFIX}${axis}_title`,
  label: `${XY_PREFIX}${axis}_label`,
  tick: `${XY_PREFIX}${axis}_tick`,
  line: `${XY_PREFIX}${axis}_line`,
});
export const XY_X_AXIS = axisKeys("x");
export const XY_Y_AXIS = axisKeys("y");
// A bar's value under `showDataLabel`, and a plot's title in the legend.
export const XY_DATA_LABEL = `${XY_PREFIX}data_label`;
export const XY_LEGEND = `${XY_PREFIX}legend`;
export const XY_PLOT = `${XY_PREFIX}plot_`;
// A plot's cell laid on an earlier bar's, the plot's ink on the bar's colour: a line's braille dots, weighed to read
// there, or a later bar's top, kept its own colour.
export type OverBar = "dots" | "top";
const XY_ON_BAR = `${XY_PREFIX}onbar_`;
export const onBarKey = (plot: number, bar: number, over: OverBar): string => `${XY_ON_BAR}${over}${INDEX_MARK}${plot}${INDEX_MARK}${bar}`;
export const onBarOf = (key: string): { readonly plot: number; readonly bar: number; readonly over: OverBar } | undefined => {
  if (!key.startsWith(XY_ON_BAR)) return undefined;
  const [over, plot, bar] = key.slice(XY_ON_BAR.length).split(INDEX_MARK);
  const [plotAt, barAt] = [Number(plot), Number(bar)];
  if (!Number.isInteger(plotAt) || !Number.isInteger(barAt)) return undefined;
  return over === "dots" || over === "top" ? { plot: plotAt, bar: barAt, over } : undefined;
};

// A journey actor's mark and legend, one of the six fills mermaid cycles through.
export const JOURNEY_ACTOR = "journey_actor_";
export const JOURNEY_TITLE = "journey_title";
// An actor's name in the legend, apart from its mark: mermaid's `.legend`, in `textColor`.
export const JOURNEY_LEGEND = "journey_legend";
// The score digits 5..1 down the right of the drop rows, in `gridColor`.
export const JOURNEY_SCALE = "journey_scale";
// A journey section header's words, and the band they are written on, the section's own wash.
export const JOURNEY_SECTION_LABEL_PREFIX = "journey_section_label" + INDEX_MARK;
export const JOURNEY_BAND_PREFIX = "journey";

// A state diagram's start dot and fork or join bar, and its end state: each inked with a variable of its own.
export const STATE_SPECIAL = "state_special";
export const STATE_END = "state_end";

// A head drawn in its line's ink but under a key of its own, which a rule stroking the line alone leaves as it was.
export const EDGE_HEAD = EDGE + tailed("head");
export const NOTE_FILL = NOTE + FILL_TAIL;
export const NOTE_LABEL = NOTE + LABEL_TAIL;
export const NOTE_RIM = NOTE + RIM_TAIL;
export const ACTOR_FILL = ACTOR + FILL_TAIL;
export const ACTOR_LABEL = ACTOR + LABEL_TAIL;
export const ACTOR_RIM = ACTOR + RIM_TAIL;
export const SUBGRAPH_FILL = SUBGRAPH + FILL_TAIL;
export const COMPOSITE_TITLE_FILL = COMPOSITE_TITLE + FILL_TAIL;
export const COMPOSITE_BODY_FILL = "composite_body" + FILL_TAIL;
export const COMPOSITE_ALT_FILL = "composite_alt" + FILL_TAIL;
// The grounds a frame lays inside its walls: a cluster's, a composite body's, and one a level down.
export const FRAME_FILLS: ReadonlySet<string> = new Set([SUBGRAPH_FILL, COMPOSITE_BODY_FILL, COMPOSITE_ALT_FILL]);
export const EDGE_CHIP = EDGE_LABEL + CHIP_TAIL;
export const ABSTRACT_LABEL = PLAIN_LABEL + ABSTRACT_TAIL;
export const STATIC_LABEL_KEY = PLAIN_LABEL + STATIC_TAIL;
export const PLAIN_LABEL_STRIPE = PLAIN_LABEL + STRIPE_TAIL;
export const NODE_FAINT_STRIPE = NODE_FAINT + STRIPE_TAIL;
export const NODE_COMPOSITE = NODE + COMPOSITE;
export const ACTOR_INDEXED = ACTOR + INDEX_MARK;
export const THEME_FILL_BAND = BAND_MARK + NODE;
export const THEME_NOTE_BAND = BAND_MARK + NOTE;
export const ROW_ODD = "rowOdd";
export const ROW_EVEN = "rowEven";
export const THEME_ROW_ODD_BAND = BAND_MARK + ROW_ODD;
export const THEME_ROW_EVEN_BAND = BAND_MARK + ROW_EVEN;
// A sequence `rect` written with no colour, grounded at paint on the theme's `rectBkgColor`.
export const RECT_BACKGROUND = "rectBkg";
export const THEME_RECT_BAND = BAND_MARK + RECT_BACKGROUND;

export const CLASS_PREFIX = "class" + INDEX_MARK;
export const NODE_STYLE_PREFIX = "nodestyle" + INDEX_MARK;
export const LINK_STYLE_PREFIX = "linkstyle" + INDEX_MARK;
export const DEFAULT_LINK = -1;
export const SECTION_PREFIX = "section" + INDEX_MARK;
export const SECTION_FOREGROUND_PREFIX = "sectionfg" + INDEX_MARK;
export const SECTION_BACKGROUND_PREFIX = "sectionbg" + INDEX_MARK;
// A timeline event, inked as its section's periods but reached apart by `.eventWrapper`.
export const TIMELINE_EVENT_PREFIX = "timeline_event" + INDEX_MARK;
// mermaid's `.section-root`: the mindmap root on `git0`, apart from every branch's section.
export const SECTION_ROOT = SECTION_PREFIX + "root";
// The SVG element mermaid draws a mindmap node's shape with, `section:3@svg:rect`, the default shape's `path`
// leaving the key bare.
export type ShapeElement = "rect" | "path" | "polygon" | "circle";
export const SHAPE_ELEMENTS: readonly ShapeElement[] = ["rect", "path", "polygon", "circle"];
const SVG_MARK = tailed("svg:");
export const elementKey = (key: string, element: ShapeElement): string => (element === "path" ? key : key + SVG_MARK + element);
export const EXCLUDED_BAND = "excluded";
// A pie's inks, `pieStyles.ts`: a slice, on the circle and on its legend swatch alike, and the three texts.
export const PIE_SLICE_PREFIX = "pieslice" + INDEX_MARK;
export const PIE_TITLE = "pie_title";
export const PIE_SECTION_TEXT = "pie_section";
export const PIE_LEGEND_TEXT = "pie_legend";
// A packet's title under its rows, in the kind's own title ink.
export const PACKET_TITLE = "packet_title";
// A treemap's inks, `paint/treemap.ts`: what the cell draws, the ground it stands on as the fill seats of its sections
// from the root down, a leaf's closed by the leaf mark, each followed by its `classDef` fill if any, and a text's
// `cScaleLabel` seat. A slab is a borderless box's outline, its own ground inked over its parent's.
export const TREEMAP_PARTS = ["frame", "box", "blank", "label", "value", "slab"] as const;
export type TreemapPart = (typeof TREEMAP_PARTS)[number];
export const TREEMAP_PREFIX = "treemap" + INDEX_MARK;
export const TREEMAP_LEAF_MARK = "+";
export const TREEMAP_SEAT_JOIN = ".";
// A `classDef` ink the cell wears over its seat's, its `stroke` on a frame or a box, its `color` on a text.
export const treemapKey = (part: TreemapPart, ground: string, seat?: number, ink?: string): string =>
  [TREEMAP_PREFIX + part, ground, ...(seat === undefined && ink === undefined ? [] : [seat === undefined ? "" : String(seat)]), ...(ink === undefined ? [] : [ink])].join(INDEX_MARK);
export const treemapKeyParts = (key: string): readonly string[] | undefined =>
  key.startsWith(TREEMAP_PREFIX) ? key.slice(TREEMAP_PREFIX.length).split(INDEX_MARK) : undefined;
// A gitGraph's inks, `git/styles.js`: per branch index its `.arrow`, `.commit`, `.commit-highlight` and `.branch-label`
// over `.label`, then the `.branch` spine, the cherry-pick bullet, `.tag-label` in `.tag-label-bkg` and `.commit-label`.
export const GIT_LINE_PREFIX = "gitline" + INDEX_MARK;
export const GIT_COMMIT_PREFIX = "gitcommit" + INDEX_MARK;
export const GIT_HIGHLIGHT_PREFIX = "githighlight" + INDEX_MARK;
export const GIT_BRANCH_PREFIX = "gitbranch" + INDEX_MARK;
export const GIT_SPINE = "git_spine";
export const GIT_CHERRY_PICK = "git_cherry_pick";
export const GIT_CHERRY_CAP = "git_cherry_cap";
// A cherry-pick drawn as a bullet, where the charset has no cherry: the bullet itself is the cherry's red.
export const GIT_CHERRY_BULLET = "git_cherry_bullet";
export const GIT_TAG = "git_tag";
export const GIT_TAG_RIM = "git_tag_rim";
export const GIT_COMMIT_LABEL = "git_commit_label";
// A gantt's inks, `gantt/styles.js`: the plain `.task` fill, each state's stroke, the text outside a bar, the title, a
// section's `.sectionTitle` and its band, one of mermaid's four `.section` rects.
export const GANTT_TASK = "gantt_task";
export const CRIT_BORDER = "crit_border";
export const GANTT_OUTSIDE_TEXT = "gantt_outside_text";
// An active bar's name beside it, which mermaid's `.activeText` rule inks `taskTextDarkColor` over the outside ink.
export const GANTT_OUTSIDE_ACTIVE_TEXT = "gantt_outside_active_text";
// The dates under or over the chart, mermaid's `.grid .tick text`.
export const GANTT_AXIS_TEXT = "gantt_axis_text";
// A clickable task's name, written in mermaid's `taskTextClickableColor` and bold.
export const CLICKABLE_TAIL = tailed("clickable");
export const GANTT_TITLE = "gantt_title";
export const GANTT_GRID = "gantt_grid";
export const GANTT_MILESTONE = "gantt_milestone";
export const GANTT_SECTION_TITLE_PREFIX = "gantt_section_title" + INDEX_MARK;
export const GANTT_BAND_PREFIX = "gantt";
// A name written inside its compact bar, on the bar's own fill: the prefix, then the fill's own key.
export const GANTT_INSIDE_PREFIX = "gantt_inside" + INDEX_MARK;

export const DIM_SUFFIX = INDEX_MARK + "dim";
export const DEEP_SUFFIX = INDEX_MARK + "deep";

export const indexed = (prefix: string, index: number): string => prefix + index;

export const sectionForeground = (index: number): string => indexed(SECTION_FOREGROUND_PREFIX, index);

// The index `indexed` wrote after `prefix`, `undefined` for a key it did not write.
export const indexAfter = (key: string, prefix: string): number | undefined => {
  if (!key.startsWith(prefix)) return undefined;
  const index = Number(key.slice(prefix.length));
  return Number.isInteger(index) ? index : undefined;
};

// A label read as markdown comes back in runs, and each run is painted under the key its ink asks for. The
// prefix is whatever the caller paints under, a node's theme style or nothing at all, so one mapping serves
// every box that draws a rich label.
export const inkRuns = (
  segments: readonly { text: string; bold: boolean; italic: boolean }[],
  prefix = "",
  plain: string = LABEL
): Array<readonly [string, string]> =>
  segments.map(
    (seg) => [seg.text, prefix + plain + (seg.bold ? BOLD_MARK : seg.italic ? ITALIC_MARK : "")] as const
  );
