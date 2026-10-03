import { render } from "../src/index.js";
import { messageOf } from "../src/text/format.js";
import { ELLIPSIS } from "../src/text/chars.js";

const WIDE = 200;
const MIN_PREFIX = 3;

interface Subject {
  type: string;
  shape: string;
  source: string;
  expect: readonly string[];
}

const S = ["Zephyr", "Kraken", "Basalt", "Nimbus", "Cobalt", "Quartz", "Obsidian", "Granite", "Marble", "Feldspar"];
const [Z, K, B, N, C, Q, O, G, M, F] = S;

const SUBJECTS: readonly Subject[] = [
  { type: "flowchart", shape: "every node shape", expect: [Z, K, B, N, C, Q, O, G],
    source: `flowchart LR\n  a[${Z}] --> b(${K}) --> c([${B}]) --> d[[${N}]]\n  d --> e[(${C})] --> f((${Q})) --> g{${O}} --> h{{${G}}}\n` },
  { type: "flowchart", shape: "edge labels", expect: [Z, K, B, N, C],
    source: `flowchart LR\n  ${Z} -->|${K}| ${B}\n  ${B} -.->|${N}| ${C}\n` },
  { type: "flowchart", shape: "nested subgraphs", expect: [Z, K, B, N, C],
    source: `flowchart TD\n  subgraph ${Z}\n    subgraph ${K}\n      ${B} --> ${N}\n    end\n  end\n  ${N} --> ${C}\n` },
  { type: "flowchart", shape: "styles and classes", expect: [Z, K],
    source: `flowchart LR\n  ${Z} --> ${K}\n  classDef hot fill:#f00\n  class ${Z} hot\n` },

  { type: "state", shape: "composite states", expect: [Z, K, B, N],
    source: `stateDiagram-v2\n  [*] --> ${Z}\n  state ${Z} {\n    ${K} --> ${B} : ${N}\n  }\n  ${Z} --> [*]\n` },
  { type: "state", shape: "two transitions between the same states", expect: [Z, K, B, N, C],
    source: `stateDiagram-v2\n  [*] --> ${Z}\n  state ${Z} {\n    ${K} --> ${B} : ${N}\n    ${B} --> ${K} : ${C}\n  }\n` },
  { type: "state", shape: "notes and aliases", expect: [Z, K, B],
    source: `stateDiagram-v2\n  state "${Z}" as s1\n  s1 --> ${K}\n  note right of ${K} : ${B}\n` },
  { type: "state", shape: "choice and fork", expect: [Z, K, B],
    source: `stateDiagram-v2\n  state ${Z} <<choice>>\n  ${K} --> ${Z}\n  ${Z} --> ${B}\n` },

  { type: "sequence", shape: "notes on all three sides", expect: [Z, K, B, N, C],
    source: `sequenceDiagram\n  participant ${Z}\n  participant ${K}\n  Note left of ${Z}: ${B}\n  Note over ${Z},${K}: ${N}\n  Note right of ${K}: ${C}\n` },
  { type: "sequence", shape: "loop, alt and opt blocks", expect: [Z, K, B, N, C, Q],
    source: `sequenceDiagram\n  ${Z}->>${K}: ${B}\n  loop ${N}\n    ${K}->>${Z}: ${C}\n  end\n  alt ${Q}\n    ${Z}->>${K}: ok\n  end\n` },
  { type: "sequence", shape: "activation and destruction", expect: [Z, K, B, N],
    source: `sequenceDiagram\n  ${Z}->>+${K}: ${B}\n  ${K}-->>-${Z}: ${N}\n  destroy ${K}\n` },

  { type: "class", shape: "members and visibilities", expect: [Z, K, B, N],
    source: `classDiagram\n  class ${Z} {\n    +String ${K}\n    -int ${B}\n    #${N}() void\n  }\n` },
  { type: "class", shape: "cardinalities and relations", expect: [Z, K, B],
    source: `classDiagram\n  ${Z} "1" --> "*" ${K} : ${B}\n` },
  { type: "class", shape: "annotations", expect: [Z, K],
    source: `classDiagram\n  class ${Z} {\n    <<${K}>>\n  }\n` },

  { type: "er", shape: "attributes, keys and comment", expect: [Z, K, B, N, C],
    source: `erDiagram\n  ${Z} {\n    string ${K} PK\n    string ${B} UK "${N}"\n    int ${C}\n  }\n` },
  { type: "er", shape: "cardinalities", expect: [Z, K, B],
    source: `erDiagram\n  ${Z} ||--o{ ${K} : ${B}\n` },

  { type: "gantt", shape: "sections and task states", expect: [Z, K, B, N, C],
    source: `gantt\n  title ${Z}\n  dateFormat YYYY-MM-DD\n  section ${K}\n    ${B} :done, t1, 2024-01-01, 2024-01-14\n    ${N} :active, t2, 2024-01-08, 2024-01-21\n  section ${C}\n    other :t3, 2024-01-15, 5d\n` },
  { type: "gantt", shape: "milestone and dependency", expect: [Z, K, B],
    source: `gantt\n  title ${Z}\n  dateFormat YYYY-MM-DD\n  section s\n    ${K} :t1, 2024-01-01, 5d\n    ${B} :milestone, t2, after t1, 1d\n` },

  { type: "gitgraph", shape: "branches, tags and merge", expect: [Z, K, B, N, C],
    source: `gitGraph\n  commit id: "${Z}"\n  commit id: "${K}" tag: "${B}"\n  branch ${N}\n  commit id: "${C}"\n  checkout main\n  merge ${N}\n` },
  { type: "gitgraph", shape: "commit types", expect: [Z, K, B],
    source: `gitGraph\n  commit id: "${Z}" type: HIGHLIGHT\n  commit id: "${K}" type: REVERSE\n  commit id: "${B}"\n` },

  { type: "journey", shape: "sections, notes and actors", expect: [Z, K, B, N, C],
    source: `journey\n  title ${Z}\n  section ${K}\n    ${B}: 5: ${N}\n    ${C}: 3: ${N}\n` },

  { type: "kanban", shape: "columns, cards and assignment", expect: [Z, K, B, N],
    source: `kanban\n  col1[${Z}]\n    t1[${K}]\n    t2[${B}] @${N}\n` },

  { type: "mindmap", shape: "depth", expect: [Z, K, B, N],
    source: `mindmap\n  ${Z}\n    ${K}\n      ${B}\n        ${N}\n` },
  { type: "mindmap", shape: "node shapes", expect: [Z, K, B],
    source: `mindmap\n  ${Z}\n    [${K}]\n    {{${B}}}\n` },

  { type: "packet", shape: "contiguous fields", expect: [Z, K, B],
    source: `packet-beta\n  0-15: "${Z}"\n  16-31: "${K}"\n  32-63: "${B}"\n` },

  { type: "pie", shape: "title and values", expect: [Z, K, B, N],
    source: `pie showData\n  title ${Z}\n  "${K}" : 45\n  "${B}" : 30\n  "${N}" : 25\n` },

  { type: "quadrant", shape: "axes, quadrants and points", expect: [Z, K, B, N, C, Q, O, G, M, F],
    source: `quadrantChart\n  title ${Z}\n  x-axis ${K} --> ${B}\n  y-axis ${N} --> ${C}\n  quadrant-1 ${Q}\n  quadrant-2 ${O}\n  quadrant-3 ${G}\n  quadrant-4 ${M}\n  ${F}: [0.8, 0.9]\n` },

  { type: "timeline", shape: "sections and several events", expect: [Z, K, B, N, C, Q],
    source: `timeline\n  title ${Z}\n  section ${K}\n    ${B} : ${N}, ${C}\n  section ${Q}\n    alone\n` },

  { type: "treemap", shape: "nesting and values", expect: [Z, K, B, N, C],
    source: `treemap-beta\n"${Z}"\n  "${K}": 40\n  "${B}": 25\n  "${N}"\n    "${C}": 15\n` },

  { type: "xychart", shape: "title, two axes, bars", expect: [Z, K, B, N, C, Q],
    source: `xychart-beta\n  title "${Z}"\n  x-axis "${K}" [${B}, ${N}, ${C}]\n  y-axis "${Q}" 0 --> 50\n  bar [10, 25, 40]\n` },
  { type: "xychart", shape: "line", expect: [Z, K, B],
    source: `xychart-beta\n  title "${Z}"\n  x-axis [${K}, ${B}]\n  line [5, 15]\n` },

  { type: "architecture", shape: "groups, services and junctions", expect: [Z, K, B, N],
    source: `architecture-beta\n  group g1(cloud)[${Z}]\n  service s1(database)[${K}] in g1\n  service s2(server)[${B}] in g1\n  service s3(internet)[${N}]\n  s1:R --> L:s2\n  s2:R --> L:s3\n` },

  { type: "block", shape: "every shape", expect: [Z, K, B, N, C, Q],
    source: `block-beta\n  columns 3\n  a["${Z}"] b("${K}") c(["${B}"])\n  d{"${N}"} e(("${C}")) f{{"${Q}"}}\n` },
  { type: "block", shape: "arrows and spaces", expect: [Z, K],
    source: `block-beta\n  columns 3\n  a["${Z}"] space b["${K}"]\n  a --> b\n` },
];

function longestPrefix(drawn: string, token: string): string {
  for (let n = token.length - 1; n >= MIN_PREFIX; n--) {
    const prefix = token.slice(0, n);
    if (drawn.includes(prefix)) return prefix;
  }
  return "";
}

interface Finding {
  type: string;
  shape: string;
  token: string;
  verdict: "ABSENT" | "CUT";
  detail: string;
}

const findings: Finding[] = [];
let tokens = 0;

for (const subject of SUBJECTS) {
  let drawn: string;
  try {
    drawn = render(subject.source, { width: WIDE });
  } catch (e) {
    findings.push({ type: subject.type, shape: subject.shape, token: "-", verdict: "ABSENT", detail: `THROWS: ${messageOf(e)}` });
    continue;
  }
  for (const token of subject.expect) {
    tokens++;
    if (drawn.includes(token)) continue;
    const prefix = longestPrefix(drawn, token);
    if (prefix === "" ) {
      findings.push({ type: subject.type, shape: subject.shape, token, verdict: "ABSENT", detail: "nowhere in the drawing" });
    } else {
      const marked = drawn.includes(prefix + ELLIPSIS);
      findings.push({
        type: subject.type,
        shape: subject.shape,
        token,
        verdict: marked ? "ABSENT" : "CUT",
        detail: marked ? `truncated and marked: ${prefix}${ELLIPSIS}` : `cut WITHOUT a mark: ${prefix}`,
      });
    }
  }
}

const byType = new Map<string, Finding[]>();
for (const f of findings) byType.set(f.type, [...(byType.get(f.type) ?? []), f]);

console.log(`${SUBJECTS.length} sources, ${tokens} tokens checked\n`);
for (const subject of [...new Set(SUBJECTS.map((s) => s.type))]) {
  const hits = byType.get(subject) ?? [];
  console.log(`${subject.padEnd(14)} ${hits.length === 0 ? "complete" : `${hits.length} missing`}`);
  for (const f of hits) console.log(`    ${f.verdict.padEnd(7)} ${f.token.padEnd(9)} ${f.detail}   [${f.shape}]`);
}
const cut = findings.filter((f) => f.verdict === "CUT").length;
console.log(`\n${findings.length} missing out of ${tokens} tokens, ${cut} of them cut WITHOUT a mark`);
