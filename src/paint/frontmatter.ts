import { DARK_BACKGROUND, type Background } from "../colour/background.js";
import { dressed, groundOf, twinOf, type BackgroundOption } from "./ground.js";
import { MERMAID_THEME_NAMES } from "./mermaid-themes.js";
import { cssOfTheme } from "./css-writer.js";
import { CONFIG_KEY, CSS_KEY, THEME_KEY, VARIABLES_KEY } from "./theme-block.js";
import { mermaidVariablesOf, readThemeText } from "./themes.js";
import { FRONTMATTER_RE } from "../source/lines.js";
import { indentOf } from "../text/format.js";
import { withoutBom } from "../source/source.js";
import { CLASSIC_MERMAID_BLOCK } from "./classic.js";
import { must } from "../must.js";
import { NEWLINE } from "../text/chars.js";
import { THEMES, getTheme } from "./catalogue.js";
import { FRAME_OPACITY, type Theme } from "./theme-model.js";
import { sourceConfig, type SourceConfig } from "../source/config.js";

// A blank that stays on its line.
const INLINE = "[^\\S\\n]";
const CONFIG_OPEN_RE = new RegExp(`^${CONFIG_KEY}:${INLINE}*$`, "u");
const THEME_ENTRY_RE = new RegExp(`^${INLINE}+${THEME_KEY}:(?:${INLINE}.*)?$`, "u");
const VARIABLES_BLOCK_RE = new RegExp(`^(${INLINE}*)${VARIABLES_KEY}:${INLINE}*\\n(?:\\1${INLINE}+\\S[^\\n]*\\n?)*`, "mu");
const CSS_LINE_RE = new RegExp(`^${INLINE}*${CSS_KEY}:[^\\n]*\\n?`, "mu");
const INDENT = "  ";
const FENCE = "---";
const themeLine = (indent: string, theme: string): string => `${indent}${THEME_KEY}: ${theme}`;

// The theme a source asks for, as `themeAsked` reads it: the diagram's own `config.<section>.theme` over the
// global one, an init directive over the frontmatter. mermaid reads no `theme` at the frontmatter's root.
const namedTheme = (said: SourceConfig, section: string | undefined): string | undefined =>
  (section === undefined ? undefined : said.section(section)[THEME_KEY]) ?? said.config[THEME_KEY];

export const readFrontmatterCss = (source: string): string | undefined => sourceConfig(withoutBom(source)).config[CSS_KEY];

export const readFrontmatterTheme = (source: string, section?: string): string | undefined =>
  namedTheme(sourceConfig(withoutBom(source), section), section);

// The fence has to open the text: mermaid reads no frontmatter standing behind whitespace, so the source's own
// leading blank space is dropped rather than pushed in front of the block.
const split = (source: string): { block: RegExpExecArray | undefined; body: string } => {
  const body = source.trimStart();
  return { block: FRONTMATTER_RE.exec(body) ?? undefined, body };
};

// The root `config:` line, the indent its entries stand at, and its own `theme:` line when it has one.
function configLines(lines: readonly string[]): { open: number; indent: string; theme: number | undefined } | undefined {
  const open = lines.findIndex((line) => CONFIG_OPEN_RE.test(line));
  if (open === -1) return undefined;
  let indent: string | undefined;
  for (let at = open + 1; at < lines.length; at++) {
    const line = lines[at];
    if (line.trim() === "") continue;
    const lead = line.slice(0, indentOf(line));
    if (lead === "") break;
    indent ??= lead;
    if (lead === indent && THEME_ENTRY_RE.test(line)) return { open, indent, theme: at };
  }
  return { open, indent: indent ?? INDENT, theme: undefined };
}

export function writeFrontmatterTheme(source: string, theme: string): string {
  const { block, body } = split(source);
  if (block === undefined) return [FENCE, `${CONFIG_KEY}:`, themeLine(INDENT, theme), FENCE, body].join(NEWLINE);
  const [whole, open, inside, close] = block;
  const lines = inside.split(NEWLINE);
  const config = configLines(lines);
  if (config === undefined) lines.unshift(`${CONFIG_KEY}:`, themeLine(INDENT, theme));
  else if (config.theme === undefined) lines.splice(config.open + 1, 0, themeLine(config.indent, theme));
  else lines[config.theme] = themeLine(config.indent, theme);
  return `${open}${lines.join(NEWLINE)}${close}${body.slice(whole.length)}`;
}

export function writeMermaidTheme(source: string, theme: Theme, page: string): string {
  const named = writeFrontmatterTheme(source, "base");
  const { block, body } = split(named);
  if (block === undefined) return named;
  const [whole, open, inside, close] = block;
  const lines = inside.replace(VARIABLES_BLOCK_RE, "").replace(CSS_LINE_RE, "").split(NEWLINE);
  const config = must(configLines(lines));
  const at = must(config.theme);
  const indent = config.indent;
  const variables = mermaidVariablesOf(theme, page);
  const css = cssOfTheme(
    theme.weights,
    variables.arrowheadColor ?? undefined,
    theme.frameOpacity === FRAME_OPACITY ? undefined : theme.frameOpacity
  );
  const written = [lines[at]];
  if (css !== "") written.push(`${indent}${CSS_KEY}: "${css.replace(/"/gu, "'")}"`);
  written.push(`${indent}${VARIABLES_KEY}:`);
  for (const [name, value] of Object.entries(variables)) written.push(`${indent}${INDENT}${name}: "${value}"`);
  lines.splice(at, 1, ...written);
  return `${open}${lines.join(NEWLINE)}${close}${body.slice(whole.length)}`;
}

export const MERMAID_DECLARED: ReadonlyMap<string, string> = new Map([["classic", CLASSIC_MERMAID_BLOCK]]);

export function forMermaid(source: string, fallback: string, background: BackgroundOption, page: string): string {
  const ground = groundOf(background);
  const wanted = twinOf(readFrontmatterTheme(source) ?? fallback, (must(ground)).side);
  if (MERMAID_THEME_NAMES.includes(wanted)) return writeFrontmatterTheme(source, wanted);
  if (MERMAID_DECLARED.has(wanted) && THEMES.has(wanted)) {
    return writeMermaidTheme(source, dressed(getTheme(wanted), ground), page);
  }
  return writeFrontmatterTheme(source, ground?.side === DARK_BACKGROUND ? SIDE_DARK : SIDE_LIGHT);
}

const SIDE_DARK = "dark";
const SIDE_LIGHT = "default";  // keyword: mermaid's own word here, not a style key

// `%%{init: {...}}%%` says what the frontmatter says, and says it LAST: mermaid merges the directive over the
// frontmatter config (`preprocess.ts`, `cleanAndMerge`, 12.0.0), so a theme, a variable or a `themeCSS` named in
// both is the directive's. `section` names the diagram's own `config.<kind>` block, whose `theme` mermaid 12 reads
// over the global one.
export function themeAsked(source: string, asked: string | Theme, side?: Background, section?: string): Theme {
  const turned = (name: string | Theme): string | Theme =>
    side === undefined ? name : twinOf(typeof name === "string" ? name : name.name, side);
  const text = withoutBom(source).trim();
  const said = sourceConfig(text, section);
  const named = namedTheme(said, section);
  const variables = said.section(VARIABLES_KEY);
  const css = said.config[CSS_KEY];
  if (!FRONTMATTER_RE.test(text) && named === undefined && Object.keys(variables).length === 0 && css === undefined) return getTheme(turned(asked));
  // The theme is resolved BEFORE its variables are read: a `cScale3:` line writes into the scale this theme
  // already has, where a bare scale under it would drop every band the line does not name.
  const base = getTheme(turned(named === undefined ? asked : named));
  // A mermaid theme replays its own file over the written bands; a palette of this page's own keeps its bands under them.
  const under = MERMAID_THEME_NAMES.includes(base.name) ? {} : base.variables;
  const read = readThemeText({ theme: named, variables: new Map(Object.entries(variables)), css }, under);
  return getTheme(base, read.variables, read.weights, read.frameOpacity, read.marker);
}
