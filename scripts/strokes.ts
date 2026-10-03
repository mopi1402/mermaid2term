import { readFileSync } from "node:fs";
import { EdgeStyle } from "../src/graph/model.js";
import { UNICODE } from "../src/canvas/charsets.js";
import { segmentCells } from "../src/canvas/geometry.js";
import { drawings, rungOf, type Drawing } from "../tests/invariants/geometry.js";

const FIXTURE = new URL("../fixtures/flowchart/stroke-visibility.mmd", import.meta.url).pathname;
const HEADER_RE = /^flowchart\b.*$/mu;
const DIRECTIONS = ["TB", "LR"];

const STYLE_GLYPHS = new Map<EdgeStyle, ReadonlySet<string>>([
  [EdgeStyle.SOLID, new Set([UNICODE.lineHorizontal, UNICODE.lineVertical])],
  [EdgeStyle.DOTTED, new Set([UNICODE.lineDottedH, UNICODE.lineDottedV])],
  [EdgeStyle.THICK, new Set([UNICODE.lineThickH, UNICODE.lineThickV, "┏", "┓", "┗", "┛"])],
]);

// The edges of one drawing whose drawn path shows none of the glyphs that tell their stroke apart.
function faultsOf({ routed, canvas }: Drawing): string[] {
  return routed.flatMap((re) => {
    const wanted = STYLE_GLYPHS.get(re.edge.style);
    if (wanted === undefined || re.drawPath.length === 0) return [];
    const seen = re.drawPath.slice(1).some(([x2, y2], i) => [...segmentCells(re.drawPath[i], [x2, y2])].some(([x, y]) => wanted.has(canvas.get(y, x))));
    return seen ? [] : [`${re.edge.source}->${re.edge.target} (${re.edge.style})`];
  });
}

const source = readFileSync(FIXTURE, "utf8");
let defects = 0;

// The very drawings the other drawn checks read, the fixture turned down and across.
for (const direction of DIRECTIONS) {
  for (const drawing of drawings(source.replace(HEADER_RE, `flowchart ${direction}`))) {
    const faulted = faultsOf(drawing);
    if (faulted.length === 0) continue;
    defects += faulted.length;
    const at = `${direction} ${rungOf(drawing)}`;
    for (const line of faulted) console.error(`${line} shows no stroke at ${at}`);
    console.error(`\n----- ${at}`);
    console.error(drawing.canvas.toString());
  }
}

if (defects > 0) {
  console.error(`\n${defects} edge(s) drawn with no glyph telling their stroke apart.`);
  process.exit(2);
}
