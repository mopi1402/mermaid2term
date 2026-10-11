import { makePieChart, type PieChart } from "./model.js";
import { splitLines } from "../../text/format.js";
import { headerBody, headerOf } from "../../source/lines.js";
import { BLANK_RE, HEADER_RE, SECTION_RE } from "./grammar.js";
import { withoutAccessible } from "../@common/accessible.js";
import { titleOf, unquoted } from "../@common/langium.js";

function readStatement(chart: PieChart, statement: string): void {
  const title = titleOf(statement);
  if (title !== undefined) {
    chart.title = title;
    return;
  }

  const section = SECTION_RE.exec(statement) ?? undefined;
  if (section === undefined) {
    chart.warnings.push(`Unrecognized line: ${statement}`);
    return;
  }
  const label = unquoted(section[1]);
  const value = Number(section[2]);
  if (value < 0) {
    chart.warnings.push(`Pie slice value must not be negative: ${label} = ${value}`);
    return;
  }
  // mermaid's db is a map keyed by label, the first slice of a name kept
  if (chart.slices.some((s) => s.label === label)) return;
  chart.slices.push({ label, value });
}

export function parsePieChart(text: string): PieChart {
  const chart = makePieChart();
  const lines = splitLines(text).map((line) => line.trim());
  const first = lines.findIndex((line) => !BLANK_RE.test(line));
  if (first === -1) return chart;
  const header = headerOf(lines[first], HEADER_RE);
  if (header === undefined) chart.warnings.push(`Unrecognized header: ${lines[first]}`);
  else chart.showData = header.words[1] !== undefined;
  for (const statement of withoutAccessible(headerBody(lines.slice(first), HEADER_RE))) {
    if (!BLANK_RE.test(statement)) readStatement(chart, statement);
  }
  return chart;
}
