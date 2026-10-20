import { makeXYChart, makeXYDataset, type AxisShown, type XYChart } from "./model.js";
import { numberOf } from "../../text/format.js";
import { NEWLINE } from "../../text/chars.js";
import { SEMICOLON, contentLines } from "../../source/lines.js";
import { QUOTE, splitOutsideQuotes, stripQuotes } from "../../source/quotes.js";
import { type Declared, flagOf } from "../../source/config.js";
import { withoutAccessible } from "../@common/accessible.js";

const HORIZONTAL = "horizontal";
const SEPARATOR = ",";
const LIST_OPEN = "[";
const LIST_CLOSE = "]";
const ARROW = "-->";

const HEADER_RE = /^\s*xychart(?:-beta)?/iu;
const ORIENTATION_RE = /^\s*(vertical|horizontal)\b/iu;
// mermaid's statement keywords, each ending on a `\b`: `bar[5, 6]` is a bar, `barx` a word.
const KEYWORD_RE = /^(title|x-axis|y-axis|line|bar)\b/iu;
const NUMBER_RE = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)/u;
// Any other run is text: mermaid's `alphaNum` tokens, a number's first sign or dot left to NUMBER_RE.
const WORD_RE = /^[^\s[\]";,+\-.\d]+|^[+\-.]/u;
const BLANK_RE = /^[^\S\n]+/u;
const POINT_RE = /^(.*?)\s*(?:"([^"]*)")?$/;
const WHITESPACE_RE = /\s+/g;

type Keyword = "title" | "x-axis" | "y-axis" | "line" | "bar";
const KEYWORDS: readonly Keyword[] = ["title", "x-axis", "y-axis", "line", "bar"];

interface Spanned {
  readonly kind: "list" | "string" | "number" | "word" | "arrow";
  readonly text: string;
  readonly from: number;
  readonly to: number;
}

type Token = { readonly kind: "eol" } | { readonly kind: "keyword"; readonly word: Keyword } | Spanned;

// mermaid's lexer skips the blanks between the words of an unquoted text and joins them with nothing.
const unquoted = (text: string): string => text.replace(WHITESPACE_RE, "");

// Where a string or a list opened at `from` closes on its line, a `]` inside quotes kept as text; -1 while it runs on.
function closing(text: string, from: number, close: string): number {
  let quoted = false;
  for (let at = from; at < text.length; at++) {
    if (text[at] === NEWLINE) return -1;
    if (text[at] === close && (close === QUOTE || !quoted)) return at;
    if (text[at] === QUOTE) quoted = !quoted;
  }
  return -1;
}

function* tokens(text: string): Generator<Token> {
  let at = 0;
  const spanned = (kind: Spanned["kind"], length: number, inner = text.slice(at, at + length)): Token => {
    const token = { kind, text: inner, from: at, to: at + length };
    at += length;
    return token;
  };
  while (at < text.length) {
    const rest = text.slice(at);
    const blank = BLANK_RE.exec(rest)?.[0] ?? "";
    if (blank !== "") {
      at += blank.length;
      continue;
    }
    if (rest[0] === NEWLINE || rest[0] === SEMICOLON) {
      at += 1;
      yield { kind: "eol" };
      continue;
    }
    const keyword = KEYWORD_RE.exec(rest)?.[1]?.toLowerCase();
    const known = KEYWORDS.find((word) => word === keyword);
    if (known !== undefined) {
      at += known.length;
      yield { kind: "keyword", word: known };
      continue;
    }
    if (rest.startsWith(ARROW)) {
      yield spanned("arrow", ARROW.length);
      continue;
    }
    if (rest[0] === QUOTE || rest[0] === LIST_OPEN) {
      const end = closing(text, at + 1, rest[0] === QUOTE ? QUOTE : LIST_CLOSE);
      if (end !== -1) {
        yield spanned(rest[0] === QUOTE ? "string" : "list", end + 1 - at, text.slice(at + 1, end));
        continue;
      }
    }
    const number = NUMBER_RE.exec(rest)?.[0];
    if (number !== undefined) {
      yield spanned("number", number.length);
      continue;
    }
    yield spanned("word", (WORD_RE.exec(rest)?.[0] ?? rest[0]).length);
  }
}

// The statements the lexer's tokens make: a keyword and what follows it up to the next line end, `;` or keyword.
function statements(text: string): Array<readonly [Keyword, Spanned[]]> {
  const out: Array<readonly [Keyword, Spanned[]]> = [];
  let current: [Keyword, Spanned[]] | undefined;
  for (const token of tokens(text)) {
    if (token.kind === "eol") current = undefined;
    else if (token.kind === "keyword") {
      current = [token.word, []];
      out.push(current);
    } else current?.[1].push(token);
  }
  return out;
}

const written = (source: string, parts: readonly Spanned[]): string =>
  parts.length === 0 ? "" : source.slice(parts[0].from, parts[parts.length - 1].to).trim();

// mermaid's `text`: a string, or the words before the next number, list or arrow glued together.
function textOf(parts: readonly Spanned[]): readonly [string, number] {
  if (parts[0]?.kind === "string") return [parts[0].text, 1];
  let taken = 0;
  while (taken < parts.length && parts[taken].kind === "word") taken++;
  return [parts.slice(0, taken).map((part) => part.text).join(""), taken];
}

const AXIS_KEYS = ["showLabel", "showTitle", "showTick", "showAxisLine"] as const;

function axisShown(said: Declared, axis: string): AxisShown {
  const flag = (key: (typeof AXIS_KEYS)[number]): boolean => flagOf(said, `${axis}.${key}`) ?? true;
  return { label: flag("showLabel"), title: flag("showTitle"), tick: flag("showTick"), line: flag("showAxisLine") };
}

export function parseXYChart(text: string, said: Declared = {}): XYChart {
  const lines = contentLines(text);
  const chart = makeXYChart();
  // `chartOrientation` is the header word written in the config: `xychart-beta horizontal` says the same thing,
  // and either of the two turns the chart on its side.
  if (said["chartOrientation"]?.toLowerCase() === HORIZONTAL) chart.horizontal = true;
  chart.showLegend = flagOf(said, "showLegend") ?? chart.showLegend;
  chart.showDataLabel = flagOf(said, "showDataLabel") ?? chart.showDataLabel;
  chart.dataLabelOutside = flagOf(said, "showDataLabelOutsideBar") ?? chart.dataLabelOutside;
  chart.showTitle = flagOf(said, "showTitle") ?? chart.showTitle;
  chart.xShown = axisShown(said, "xAxis");
  chart.yShown = axisShown(said, "yAxis");
  if (lines.length === 0) return chart;

  // mermaid needs no line end after the header: its orientation word, then any statement, may follow on its line.
  let body = [lines[0].replace(HEADER_RE, ""), ...withoutAccessible(lines.slice(1))].join(NEWLINE);
  const orientation = ORIENTATION_RE.exec(body) ?? undefined;
  if (orientation !== undefined) {
    if (orientation[1].toLowerCase() === HORIZONTAL) chart.horizontal = true;
    body = body.slice(orientation[0].length);
  }

  for (const [keyword, parts] of statements(body)) {
    if (keyword === "title") {
      chart.title = parts.length === 1 && parts[0].kind === "string" ? parts[0].text : stripQuotes(written(body, parts));
    } else if (keyword === "x-axis" || keyword === "y-axis") {
      parseAxis(body, parts, chart, keyword === "x-axis");
    } else {
      parsePlot(parts, chart, keyword);
    }
  }

  return chart;
}

function parseAxis(source: string, parts: readonly Spanned[], chart: XYChart, isX: boolean): void {
  const [title, taken] = textOf(parts);
  const rest = parts.slice(taken);
  const setTitle = (label: string): void => {
    if (isX) chart.xLabel = label;
    else chart.yLabel = label;
  };

  if (rest[0]?.kind === "list" && bandOf(rest[0].text).length > 0) {
    if (taken > 0) setTitle(title);
    // The last x axis wins, a band over a range written before it and the other way round, as mermaid's db.
    if (isX) [chart.xCategories, chart.xRange] = [bandOf(rest[0].text), undefined];
    return;
  }

  const [low, arrow, high] = rest;
  if (low?.kind === "number" && arrow?.kind === "arrow" && high?.kind === "number") {
    if (taken > 0) setTitle(title);
    const bounds = [Number(low.text), Number(high.text)] as const;
    // A range too wide to hold as a number is left unwritten.
    const held = Number.isFinite(bounds[1] - bounds[0]) ? bounds : undefined;
    if (isX) [chart.xCategories, chart.xRange] = [[], held];
    else chart.yRange = held;
    return;
  }

  setTitle(rest.length === 0 ? title : stripQuotes(written(source, parts)));
}

// A band's names, quoted ones as written and the words of an unquoted one glued, as mermaid's `text`.
const bandOf = (inner: string): string[] =>
  splitOutsideQuotes(inner, SEPARATOR)
    .map((item) => item.trim())
    .filter((item) => item !== "")
    .map((item) => (item.startsWith(QUOTE) ? stripQuotes(item) : unquoted(item)));

// `bar "Title" [5, 6 "label"]`: the title, quoted or not, before the list, each value followed by its own label.
function parsePlot(parts: readonly Spanned[], chart: XYChart, chartType: "bar" | "line"): void {
  const [title, taken] = textOf(parts);
  const list = parts[taken];
  if (list?.kind !== "list") return;
  const values: number[] = [];
  const pointLabels: string[] = [];
  for (const item of splitOutsideQuotes(list.text, SEPARATOR)) {
    const point = POINT_RE.exec(item.trim()) ?? undefined;
    const value = point === undefined ? undefined : numberOf(point[1].replace(/^\++/, ""));
    if (point === undefined || value === undefined || !Number.isFinite(value)) continue;
    values.push(value);
    pointLabels.push(point[2] ?? "");
  }
  if (values.length > 0) chart.datasets.push(makeXYDataset(values, chartType, title, pointLabels));
}
