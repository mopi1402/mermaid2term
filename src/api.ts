import { cssLabelled, lookedTheme, sectionTheme } from "./paint/section-theme.js";
import { Direction, Graph } from "./graph/model.js";
import { renderGraph } from "./graph/render/draw.js";
import { foldsIntoBands } from "./graph/layout/passes.js";
import { DEFAULT_RENDER, type RenderOptions } from "./options.js";
import { paintGraph } from "./graph/paint-graph.js";
import { paintCanvas } from "./paint/painter.js";
import { Text } from "./paint/text.js";
import { type Painting } from "./paint/painting.js";
import { dressed, groundOf, type BackgroundOption } from "./paint/ground.js";
import { hostGround } from "./paint/environment.js";
import { readFrontmatterCss, themeAsked } from "./paint/frontmatter.js";
import { classRulesOf } from "./paint/css-rules.js";
import { cssRestyles } from "./paint/themecss/restyle.js";
import { titleRestyles, titleStyle } from "./paint/journey.js";
import { NEWLINE, NUL, SPACE } from "./text/chars.js";
import { declaredKind, graphKind } from "./diagrams/kinds.js";
import { overlaid, STILL, type Drawing, type ThemeFacts } from "./diagrams/@common/kind.js";
import { blockOf, foldedTitle, seatOf, TITLE_GAP } from "./diagrams/@common/titled.js";
import { announcing, configured, frontmatterTitle, headed, sourceSpacing } from "./source/source.js";
import { COMMENT } from "./source/lines.js";
import { type Fit, oriented } from "./fit.js";
import { widestLine } from "./text/width.js";
import { DEFAULT_THEME, getTheme } from "./paint/catalogue.js";
import { HEAVY_LIFELINE, type Theme } from "./paint/theme-model.js";
import { rootBand } from "./paint/sections.js";
import { gradientOf } from "./paint/gradient.js";
import { colorSlotsOf } from "./paint/color-slots.js";

function titleRows(title: string, drawing: string, width: number | undefined): string {
  const wide = widestLine(drawing);
  const lines = foldedTitle(title, width, wide);
  const block = blockOf(lines);
  const seated = lines.map((line) => `${SPACE.repeat(seatOf(undefined, undefined, Math.max(wide, block), block, line))}${line}`);
  return `${seated.join(NEWLINE)}${NEWLINE.repeat(TITLE_GAP)}`;
}

export interface Options extends Partial<RenderOptions> {
  width?: number;
  height?: number | undefined;
  background?: BackgroundOption;
}

const themeOf = (theme: string | Theme): Theme => (typeof theme === "string" ? getTheme(theme) : theme);
const factsOf = (theme: string | Theme, looked: Partial<RenderOptions>): ThemeFacts => ({
  heavyLifeline: themeOf(theme).lifelineWidth >= HEAVY_LIFELINE,
  actorsFilled: themeOf(theme).variables.actorBkg !== undefined,
  rootFilled: rootBand(themeOf(theme)) !== undefined,
  gradient: gradientOf(themeOf(theme), looked.look, looked.lookAsked) !== undefined,
  archEdgeWidth: themeOf(theme).variables.archEdgeWidth,
  archGroupBorderWidth: themeOf(theme).variables.archGroupBorderWidth,
  colorSlots: colorSlotsOf(themeOf(theme)),
});

// The `config.<section>` block the source's kind reads.
const sectionOf = (source: string): string => {
  const text = headed(source);
  return declaredKind(text)?.section ?? graphKind(text).section;
};

export function declaredType(source: string): string | undefined {
  const text = headed(source);
  return declaredKind(text)?.prefix ?? (graphKind(text).declares(announcing(text)) ? graphKind(text).prefix : undefined);
}

export function parse(source: string): Graph {
  const text = headed(source);
  return graphKind(text).parse(text);
}

function made(
  source: string,
  options: Partial<RenderOptions>,
  budget: number | undefined,
  direction: Direction | undefined,
  painting: ThemeFacts | undefined
): Drawing {
  const text = titledBody(source);
  // The kind is read first: only the section it owns is taken out of the frontmatter, so `config.class` says
  // nothing to a sequence and a key under the wrong name is the silence it is in mermaid.
  const kind = declaredKind(text);
  const o = configured(source, options, kind?.section ?? graphKind(text).section);
  if (kind !== undefined) return kind.render(text, o, budget, direction, painting);
  const engine = graphKind(text);
  const eo = overlaid(engine.options, { ...o, config: { ...engine.defaults, ...o.config } });
  const graph = headedGraph(text, direction, eo);
  dressFromThemeCss(graph, readFrontmatterCss(source));
  return { drawn: "graph", graph, options: eo, foldBudget: budget };
}

// A `themeCSS` rule naming a class dresses the nodes wearing it, under the `classDef` mermaid writes on the element
// itself: what the class states wins, even over `!important`.
function dressFromThemeCss(graph: Graph, css: string | undefined): void {
  if (css === undefined) return;
  for (const [name, props] of classRulesOf(css)) graph.classDefs.set(name, new Map([...props, ...(graph.classDefs.get(name) ?? [])]));
}

// The fit asks some graphs the same drawing twice, a band count the graph ignores among them: one call draws each once.
function once<T>(memo: Map<string, T>, graph: Graph, options: Partial<RenderOptions>, draw: () => T): T {
  const read = foldsIntoBands(graph) ? options : { ...options, bands: DEFAULT_RENDER.bands };
  const key = JSON.stringify([graph.direction, read], (_, value: unknown) => (value === undefined ? NUL : value));
  const known = memo.get(key);
  if (known !== undefined) return known;
  const fresh = draw();
  memo.set(key, fresh);
  return fresh;
}

function drawn(source: string, options: Partial<RenderOptions>, budget: number | undefined, direction: Direction | undefined, memo: Map<string, string>): string {
  const drawing = made(source, options, budget, direction, undefined);
  if (drawing.drawn === "canvas") return drawing.canvas.toString();
  return once(memo, drawing.graph, options, () => renderGraph(drawing.graph, drawing.options, drawing.foldBudget));
}

function painted(
  source: string,
  options: Partial<RenderOptions>,
  theme: string | Theme,
  budget: number | undefined,
  direction: Direction | undefined,
  memo: Map<string, Painting>
): Painting {
  const section = sectionOf(source);
  const looked = configured(source, options, section);
  const drawing = made(source, options, budget, direction, factsOf(theme, looked));
  const worn = typeof theme === "string" ? theme : lookedTheme(theme, section, looked.look);
  if (drawing.drawn === "canvas") return paintCanvas(drawing.canvas, worn, looked.look, looked.lookAsked);
  return once(memo, drawing.graph, options, () => paintGraph(drawing.graph, drawing.options, worn, drawing.foldBudget));
}

function headedGraph(text: string, direction: Direction | undefined, options: Partial<RenderOptions>): Graph {
  const graph = graphKind(text).parse(text, options);
  if (direction !== undefined && !graph.directionDeclared) graph.direction = direction;
  return graph;
}

function orientation(source: string, options: Partial<RenderOptions>): { start: Direction | undefined; turns: boolean } {
  const text = headed(source);
  const kind = declaredKind(text);
  if (kind !== undefined) return kind.orientation(text, configured(source, options, kind.section));
  const engine = graphKind(text);
  return engine.declares(announcing(text)) ? engine.orientation(text, configured(source, options, engine.section)) : STILL;
}

// The engine's drawings breathe and tighten on the fit's ladder, a kind's own only tighten there, unless it fits itself
// (or only spaces, when it reads neither bands nor wrapped labels).
function fitOf(source: string): Fit {
  const kind = declaredKind(headed(source));
  if (kind === undefined) return "breathes";
  return kind.fitsItself ? "itself" : kind.folds ? "tightens" : "spaces";
}

// mermaid hands a frontmatter title to the db BEFORE it parses (`Diagram.fromText`, 11.17.0), so a `title`
// statement in the body overwrites it and ONE title is ever drawn. Only a kind whose grammar carries that
// statement takes it back: anywhere else `title x` is an ordinary line, a flowchart node among others.
const TITLE_LINE_RE = /^[^\S\n]*title[^\S\n]*:?[^\S\n]+\S/imu;
const HEADER_TITLE_RE = /\btitle[^\S\n]+\S/iu;

// A kind whose grammar carries `title` draws the frontmatter one as its own, with its own ink and seat, as mermaid's
// `setDiagramTitle` makes them one: it is handed the statement under its header, and only the kinds mermaid gives a
// `showTitle` (xyChart, quadrantChart) take it off again, in their own parsers.
function titledBody(source: string): string {
  const body = headed(source);
  const kind = declaredKind(body);
  if (kind?.titled !== true) return body;
  const title = kindTitle(source);
  if (title === "") return body;
  const lines = body.split(NEWLINE);
  const header = lines.findIndex((line) => line.trim() !== "" && !line.trim().startsWith(COMMENT));
  lines.splice(header + 1, 0, kind.titleStatement(title));
  return lines.join(NEWLINE);
}

// The title the page draws above the drawing: a kind with no `title` statement of its own leaves it to the page.
function drawnTitle(source: string): string {
  return declaredKind(headed(source))?.titled === true ? "" : frontmatterTitle(source);
}

function kindTitle(source: string): string {
  const title = frontmatterTitle(source);
  if (title === "") return "";
  const body = headed(source);
  const header = body.slice(0, body.indexOf(NEWLINE) === -1 ? body.length : body.indexOf(NEWLINE));
  return TITLE_LINE_RE.test(body) || HEADER_TITLE_RE.test(header) ? "" : title;
}

export function render(source: string, options: Options = {}): string {
  const { width, height, background: _background, ...asked } = options;
  const renderOptions = { ...asked, ...sourceSpacing(source, sectionOf(source), DEFAULT_RENDER) };
  const { start, turns } = orientation(source, renderOptions);
  const memo = new Map<string, string>();
  const drawing = oriented(
    (o, direction) => drawn(source, o, width, direction, memo),
    (result) => result,
    renderOptions,
    width,
    height,
    fitOf(source),
    start,
    turns
  );
  const title = drawnTitle(source);
  if (title === "") return drawing;
  const text = new Text(drawing);
  const body = text.fromRow(text.blankTop).plain;
  return `${titleRows(title, body, width)}\n${body}`;
}

export function renderThemedText(source: string, options: Options = {}, theme: string = DEFAULT_THEME): Text {
  const { width, height, background, ...asked } = options;
  const renderOptions = { ...asked, ...sourceSpacing(source, sectionOf(source), DEFAULT_RENDER) };
  const ground = groundOf(background ?? hostGround());
  const section = sectionOf(source);
  const viewed = sectionTheme(dressed(themeAsked(source, theme, ground?.side, section), ground), section);
  const css = readFrontmatterCss(source);
  const chosen = { ...cssLabelled(viewed, css, section), restyles: [...titleRestyles(source, section), ...cssRestyles(section, css)] };
  const finished = (text: Text): Text => (ground === undefined ? text : text.paintedForGround());
  const { start, turns } = orientation(source, renderOptions);
  const memo = new Map<string, Painting>();
  const drawing = oriented(
    (o, direction) => painted(source, o, chosen, width, direction, memo),
    (result) => result.plain,
    renderOptions,
    width,
    height,
    fitOf(source),
    start,
    turns
  ).text();
  const title = drawnTitle(source);
  if (title === "") return finished(drawing);
  const body = drawing.fromRow(drawing.blankTop);
  const rows = titleRows(title, body.plain, width);
  const heading = new Text(rows);
  const style = titleStyle(viewed.heading ?? viewed.label, source, section);
  let at = 0;
  for (const line of rows.split(NEWLINE)) {
    heading.stylize(style, at + line.search(/\S|$/u), at + line.length);
    at += line.length + 1;
  }
  return finished(Text.stacked(heading, body));
}

export interface TimedText {
  readonly text: Text;
  readonly elapsed: number;
}

export function renderThemedTextTimed(source: string, options: Options = {}, theme: string = DEFAULT_THEME): TimedText {
  const started = performance.now();
  const text = renderThemedText(source, options, theme);
  return { text, elapsed: performance.now() - started };
}

export function renderThemed(source: string, options: Options = {}, theme: string = DEFAULT_THEME): string {
  return renderThemedText(source, options, theme).toAnsi();
}

