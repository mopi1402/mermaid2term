import { makeQuadrantChart, type QuadrantChart } from "./model.js";
import { SEMICOLON, TITLE, TITLE_WORD, contentLines, headerBody, keywordRest, statementsOf } from "../../source/lines.js";
import { flagOf, type Declared } from "../../source/config.js";
import { PROP_COLOR, cssLineOf, parseCssProps, splitStyleClass } from "../../source/css.js";
import { maskQuotes, unfenced } from "../../source/quotes.js";
import { formatHex, parseHex } from "../../colour/rgb.js";
import { withoutAccessible } from "../@common/accessible.js";

const HEADER_RE = /^\s*quadrantChart/u;
const X_POSITION_KEY = "xAxisPosition";
const Y_POSITION_KEY = "yAxisPosition";
const BOTTOM = "bottom";
const RIGHT = "right";
const SHOW_TITLE_KEY = "showTitle";
// A keyword is read here followed by a plain space.
const SPACE_RE = / /u;
const AXIS_DASH = " -> ";
const AXIS_DANGLING = " -->";
// mermaid's axis delimiter, `" "*--+>" "*`, spaced or not; a quoted one is text.
const AXIS_ARROW_RE = /\s*-{2,}>\s*/u;
const POINT_RE = /^(.+?):\s*\[\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*\](.*)$/;
const shown = (text: string): string => unfenced(text.trim());

function axisLabel(text: string): string {
  const arrow = AXIS_ARROW_RE.exec(maskQuotes(text)) ?? undefined;
  if (arrow === undefined) return shown(text);
  const left = shown(text.slice(0, arrow.index));
  const right = shown(text.slice(arrow.index + arrow[0].length));
  return right === "" ? left + AXIS_DANGLING : left + AXIS_DASH + right;
}

// mermaid's `isValidColor`: a hex colour, three digits or six.
const colorOf = (props: ReadonlyMap<string, string> | undefined): string | undefined => {
  const written = props?.get(PROP_COLOR);
  const rgb = written === undefined ? undefined : parseHex(written);
  return rgb === undefined ? undefined : formatHex(rgb);
};

// Each keyword statement and what it sets from the rest of its line, trimmed.
const KEYWORDS: ReadonlyArray<readonly [string, (chart: QuadrantChart, rest: string) => void]> = [
  [TITLE_WORD, (chart, rest) => { chart.title = rest; }],
  ["x-axis", (chart, rest) => { chart.xLabel = axisLabel(rest); }],
  ["y-axis", (chart, rest) => { chart.yLabel = axisLabel(rest); }],
  ["quadrant-1", (chart, rest) => { chart.quadrant1 = shown(rest); }],
  ["quadrant-2", (chart, rest) => { chart.quadrant2 = shown(rest); }],
  ["quadrant-3", (chart, rest) => { chart.quadrant3 = shown(rest); }],
  ["quadrant-4", (chart, rest) => { chart.quadrant4 = shown(rest); }],
];

function keywordStatement(chart: QuadrantChart, statement: string): boolean {
  for (const [keyword, apply] of KEYWORDS) {
    const rest = keywordRest(statement, keyword, SPACE_RE);
    if (rest === undefined) continue;
    apply(chart, rest.trim());
    return true;
  }
  return false;
}

// A `;` ends a statement, but a title runs to its line's end, `;` and all, as mermaid's `title` state reads it.
function statementsIn(line: string): string[] {
  const parts = statementsOf(line);
  const titled = parts.findIndex((part) => part.trimStart().toLowerCase().startsWith(TITLE));
  const kept = titled === -1 ? parts : [...parts.slice(0, titled), parts.slice(titled).join(SEMICOLON)];
  return kept.map((part) => part.trim()).filter((part) => part !== "");
}

export function parseQuadrant(text: string, said: Declared = {}): QuadrantChart {
  const lines = contentLines(text);
  const chart = makeQuadrantChart();
  if (said[X_POSITION_KEY] === BOTTOM) chart.xAxisTop = false;
  if (said[Y_POSITION_KEY] === RIGHT) chart.yAxisRight = true;
  if (lines.length === 0) return chart;
  const classDefs = new Map<string, ReadonlyMap<string, string>>();
  const styled: Array<{ readonly className: string | undefined; readonly props: ReadonlyMap<string, string> }> = [];
  // mermaid's lexer takes ` *quadrantChart *`, then a statement may follow on the header line.
  const body = withoutAccessible(headerBody(lines, HEADER_RE).flatMap(statementsIn));

  for (const stripped of body) {
    if (keywordStatement(chart, stripped)) continue;
    // mermaid's quadrant `addClass` replaces a class written twice, the other kinds merge it.
    const classDef = cssLineOf(stripped);
    if (classDef !== undefined) {
      classDefs.set(classDef.names, classDef.props);
    } else {
      const point = POINT_RE.exec(stripped) ?? undefined;
      if (point !== undefined) {
        const [label, className] = splitStyleClass(point[1]);
        styled.push({ className, props: parseCssProps(point[4]) });
        chart.points.push({
          label: shown(label),
          x: Number.parseFloat(point[2]),
          y: Number.parseFloat(point[3]),
          color: undefined,
        });
      }
    }
  }

  // A point's own style over its class's, whichever line defines the class.
  styled.forEach(({ className, props }, at) => {
    chart.points[at].color = colorOf(props) ?? colorOf(className === undefined ? undefined : classDefs.get(className));
  });
  // mermaid's quadrant builder draws no title under `showTitle: false`, the `title` statement's nor the frontmatter's.
  if (flagOf(said, SHOW_TITLE_KEY) === false) chart.title = "";
  return chart;
}
