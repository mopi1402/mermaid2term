import type { RenderOptions } from "../options.js";
import { decodeEntities } from "../text/entities.js";
import { FRONTMATTER_RE } from "./lines.js";
import { BORDER_MODES, flagOf, sourceConfig, type BorderMode, type Declared } from "./config.js";

const TITLE_KEY = "title";

// Off before the header is read: left on, `trim()` keeps it, the first word becomes `\ufeffpie` and the source
// falls through to the flowchart parser.
const BOM = "﻿";
export const withoutBom = (source: string): string => (source.startsWith(BOM) ? source.slice(BOM.length) : source);

const LEADING_COMMENTS_RE = /^(?:[^\S\n]*(?:%%(?!\{)[^\n]*)?\n)*/u;

// A `%%{init: {...}}%%` line is a comment too, and mermaid strips every directive BEFORE it reads the kind
// (`preprocess.ts`, `removeDirectives`, 11.17.0). Only the kind lookup uses this: the parsers keep the
// directive, and each reads it as a comment.
// Trimmed like `headed()` trims, and for the same reason mermaid's own detectors all read `^\s*`: the header
// may be indented, and once the lines above it are gone its indentation is what a kind would be matched against.
const LEADING_ANY_COMMENTS_RE = /^(?:[^\S\n]*(?:%%[^\n]*)?\n)*/u;
export const announcing = (text: string): string => text.replace(LEADING_ANY_COMMENTS_RE, "").trimStart();

export const headed = (source: string): string =>
  decodeEntities(
    withoutBom(source).trim().replace(FRONTMATTER_RE, "").replace(LEADING_COMMENTS_RE, "").trim()
  );

// mermaid takes `title` at the frontmatter's own level alone (`extractFrontMatter`, 12.0.0).
export const frontmatterTitle = (source: string): string => (sourceConfig(withoutBom(source)).top[TITLE_KEY] ?? "").trim();

const CHARSET_KEY = "m2t_charset";  // a key of our own, mermaid has no charset
const DISPLAY_MODE_KEY = "displayMode";  // keyword: mermaid's own frontmatter key here, not a style key
const COMPACT = "compact";
const LAYOUT_KEY = "layout";
const LOOK_KEY = "look";
export const NEO_LOOK = "neo";
const CLASSIC_LOOK = "classic";
// mermaid's `LOOKS`: any other value is skipped, as `isUsableAppearance` skips it.
const LOOKS: ReadonlySet<string> = new Set([CLASSIC_LOOK, "handDrawn", NEO_LOOK]);
// mermaid 12's own defaults (`config.schema.yaml`): these sections draw in `neo`, every other one in `classic`.
const NEO_SECTIONS: ReadonlySet<string> = new Set(["flowchart", "sequence", "class", "state", "er"]);
const lookOf = (said: Declared): string | undefined => {
  const look = said[LOOK_KEY];
  return look !== undefined && LOOKS.has(look) ? look : undefined;
};
// Our own settings mermaid has no key for, read as `config.m2t_<name>`, the kind's own over the global one.
const OWN_PREFIX = "m2t_";
const INTEGER_RE = /^\d+$/u;
const bordersOf = (said: Declared, key: string): BorderMode | undefined =>
  BORDER_MODES.find((mode) => mode === said[key]);
const bandsOf = (said: Declared, key: string): number | undefined => {
  const value = said[key];
  return value !== undefined && INTEGER_RE.test(value) && Number(value) >= 1 ? Number(value) : undefined;
};
type OwnKey = "borders" | "bands" | "airyLabels" | "snugFrames" | "autoRotate";
const OWN_KEYS: { readonly [K in OwnKey]: (said: Declared, key: string) => RenderOptions[K] | undefined } = {
  borders: bordersOf,
  bands: bandsOf,
  airyLabels: flagOf,
  snugFrames: flagOf,
  autoRotate: flagOf,
};
function readOwn<K extends OwnKey>(read: Partial<RenderOptions>, name: K, own: Declared, global: Declared): void {
  const key = OWN_PREFIX + name;
  const value = OWN_KEYS[name](own, key) ?? OWN_KEYS[name](global, key);
  if (value !== undefined) read[name] = value;
}
const isOwnKey = (name: string): name is OwnKey => Object.hasOwn(OWN_KEYS, name);
const ownKeys = (read: Partial<RenderOptions>, own: Declared, global: Declared): void => {
  for (const name of Object.keys(OWN_KEYS)) if (isOwnKey(name)) readOwn(read, name, own, global);
};
export const CLASS_SECTION = "class";
const GANTT_SECTION = "gantt";
const SEQUENCE_SECTION = "sequence";
const FLOWCHART_SECTION = "flowchart";
const CURVE_KEY = "curve";
const DAGRE_LAYOUT = "dagre";
const CURVE_SECTIONS: ReadonlySet<string> = new Set([FLOWCHART_SECTION, "state", CLASS_SECTION]);
const SHARP_CURVES: ReadonlySet<string> = new Set(["linear", "step", "stepAfter", "stepBefore"]);
const WRAP_KEY = "wrap";
const WRAPPED = String(true);
const WRAP_DIRECTIVE_RE = /%%\{\s*wrap\s*\}%%/u;
export const MARKDOWN_AUTO_WRAP_KEY = "markdownAutoWrap";
const MIN_SPACED_GAP = 1;
// mermaid 12's `nodeSpacing` and `rankSpacing` in px, measured under dagre: our default gap stands for each.
const SPACING_DEFAULTS: ReadonlyMap<string, { nodeSpacing: number; rankSpacing: number }> = new Map([
  ["flowchart", { nodeSpacing: 50, rankSpacing: 50 }],
  ["state", { nodeSpacing: 50, rankSpacing: 50 }],
  ["er", { nodeSpacing: 140, rankSpacing: 80 }],
]);

// What the source says about the drawing, read over the caller's options rather than under them: the diagram
// travels with its own frontmatter, and whoever wrote it knew which drawing they meant. Only the section the
// declared kind owns is read, so a key written under another kind's name says nothing here, as in mermaid.
export function configured(source: string, options: Partial<RenderOptions>, section?: string): Partial<RenderOptions> {
  const said = sourceConfig(withoutBom(source).trim(), section);
  const read = { ...options };
  const charset = said.top[CHARSET_KEY] ?? said.config[CHARSET_KEY];
  if (charset !== undefined) read.charset = charset;
  const layout = said.config[LAYOUT_KEY];
  if (layout !== undefined) read.layout = layout;
  const own = section === undefined ? {} : said.section(section);
  ownKeys(read, own, said.config);
  if (section === undefined) return read;
  read.config = own;
  // mermaid 12's `resolveAppearance`: what the source says, the diagram's own key over the global one, then what the
  // caller set, as a site's `initialize` would, and the kind's own default last.
  // A look read once already carries whether it was asked for: the default it fell back on is not asked twice.
  const asked = lookOf(own) ?? lookOf(said.config) ?? (options.lookAsked === false ? undefined : options.look);
  read.look = asked ?? (NEO_SECTIONS.has(section) ? NEO_LOOK : CLASSIC_LOOK);
  read.lookAsked = asked !== undefined;
  // mermaid 12 reads a diagram's own `layout` over the global one.
  const ownLayout = own[LAYOUT_KEY];
  if (ownLayout !== undefined) read.layout = ownLayout;
  if (section === CLASS_SECTION) {
    const hierarchical = flagOf(own, "hierarchicalNamespaces");
    if (hierarchical !== undefined) read.hierarchicalNamespaces = hierarchical;
    const hideEmpty = flagOf(own, "hideEmptyMembersBox");
    if (hideEmpty !== undefined) read.hideEmptyMembersBox = hideEmpty;
  }
  // mermaid hands a top-level `displayMode` to the gantt section itself (`processFrontmatter`, 11.17.0), so the
  // two spellings are one key and both are read here.
  if (section === GANTT_SECTION && (own[DISPLAY_MODE_KEY] ?? said.top[DISPLAY_MODE_KEY]) === COMPACT) read.displayMode = COMPACT;
  if (section === SEQUENCE_SECTION) {
    const mirror = flagOf(own, "mirrorActors");
    if (mirror !== undefined) read.mirrorActors = mirror;
  }
  // mermaid 12 draws `flowchart.curve` under `dagre` alone, for state and class diagrams too: `elk`, its default
  // layout, rounds every corner whatever the key says. Only the straight curves and the steps keep a sharp one.
  const curve = said.section(FLOWCHART_SECTION)[CURVE_KEY];
  if (curve !== undefined && read.layout === DAGRE_LAYOUT && CURVE_SECTIONS.has(section)) read.roundedEdges = !SHARP_CURVES.has(curve);
  // mermaid 12's sequence `init`: a global `wrap: true`, or a `%%{wrap}%%` directive, turns `sequence.wrap` on,
  // and a global `false` leaves the section's own key standing.
  if (section === SEQUENCE_SECTION && (flagOf(said.config, WRAP_KEY) === true || WRAP_DIRECTIVE_RE.test(source))) {
    read.config = { ...read.config, [WRAP_KEY]: WRAPPED };
  }
  // mermaid 12 reads `markdownAutoWrap` at the top level alone, for every kind's markdown labels.
  if (flagOf(said.config, MARKDOWN_AUTO_WRAP_KEY) === false) read.config = { ...read.config, [MARKDOWN_AUTO_WRAP_KEY]: String(false) };
  return read;
}

// mermaid 12's `flowchart.padding` default, in px: state, kanban and architecture draw nothing different for their own.
const PADDING_KEY = "padding";
const FLOWCHART_PADDING_PX = 15;
const scaledPadding = (px: number, cells: number): number => Math.max(0, Math.round((px / FLOWCHART_PADDING_PX) * cells));

const pxOf = (said: string | undefined): number => {
  const trimmed = said?.trim() ?? "";
  return trimmed === "" ? Number.NaN : Number(trimmed);
};

// mermaid 12's `block.padding` default, in px, which our block's own padding stands for, its walls counted in.
const BLOCK_SECTION = "block";
const BLOCK_PADDING_PX = 8;
export const BLOCK_PADDING_CELLS = 2;
// A padding the source gave is already in the kind's own cells, never the shared default a kind reads as unset.
export const saysPadding = (own: Declared): boolean => Number.isFinite(pxOf(own[PADDING_KEY]));

// Read before the fit rather than in `configured`, which the fit's own tighter steps pass through: the source's
// padding and spacing are where the fit starts, over the caller's, and the fit may still tighten below them.
export function sourceSpacing(source: string, section: string, cells: Pick<RenderOptions, "paddingX" | "paddingY" | "gap">): Partial<RenderOptions> {
  const own = sourceConfig(withoutBom(source).trim(), section).section(section);
  const read: Partial<RenderOptions> = {};
  const px = pxOf(own[PADDING_KEY]);
  if (section === FLOWCHART_SECTION && Number.isFinite(px)) {
    read.paddingX = scaledPadding(px, cells.paddingX);
    read.paddingY = scaledPadding(px, cells.paddingY);
  }
  if (section === BLOCK_SECTION && Number.isFinite(px)) {
    read.paddingX = Math.max(0, Math.round((px / BLOCK_PADDING_PX) * BLOCK_PADDING_CELLS));
  }
  // mermaid 12 spaces the boxes by `nodeSpacing` and the ranks by `rankSpacing` under dagre alone, its default
  // `elk` and the class diagram ignoring both.
  const spacing = SPACING_DEFAULTS.get(section);
  if (spacing === undefined || configured(source, {}, section).layout !== DAGRE_LAYOUT) return read;
  const cellsOf = (key: keyof typeof spacing): number | undefined => {
    const spaced = pxOf(own[key]);
    return Number.isFinite(spaced) ? Math.max(MIN_SPACED_GAP, Math.round((spaced * cells.gap) / spacing[key])) : undefined;
  };
  const nodeGap = cellsOf("nodeSpacing");
  if (nodeGap !== undefined) read.nodeGap = nodeGap;
  const rankGap = cellsOf("rankSpacing");
  if (rankGap !== undefined) read.rankGap = rankGap;
  return read;
}
