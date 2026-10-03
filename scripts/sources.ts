import { NEWLINE } from "../src/text/chars.js";
import { LIGHT_RUNGS, type Rung } from "../tests/invariants/rungs.js";
import { drawings, type Drawing } from "../tests/invariants/geometry.js";
import { corpus, EVERY, FIXTURES } from "./corpus.js";

export interface Source {
  name: string;
  source: string;
  rungs?: readonly Rung[];
}

export const drawingsOf = (s: Source): Generator<Drawing> => drawings(s.source, s.rungs);

function generatedSource(seed: number): string {
  let state = seed >>> 0;
  const rand = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
  const lines = [`flowchart ${pick(["TB", "LR", "BT", "RL"])}`];
  const groups: string[][] = [];
  const nodes: string[] = [];
  const clusters = 2 + Math.floor(rand() * 2);
  for (let c = 0; c < clusters; c++) {
    const members: string[] = [];
    lines.push(`    subgraph G${c}`);
    const size = 1 + Math.floor(rand() * 3);
    for (let m = 0; m < size; m++) {
      const id = `N${nodes.length}`;
      const shape = pick([`[Node ${id}]`, `[(Store ${id})]`, `([Round ${id}])`, `{Gate ${id}}`, `[Node ${id}]`]);
      lines.push(`        ${id}${shape}`);
      members.push(id);
      nodes.push(id);
    }
    lines.push("    end");
    groups.push(members);
  }
  const edges = new Set<string>();
  const add = (a: string, b: string, arrow: string): void => {
    if (a !== b) edges.add(`    ${a} ${arrow} ${b}`);
  };
  const outside = (c: number): string[] => nodes.filter((id) => !groups[c].includes(id));
  for (let c = 0; c + 1 < groups.length; c++) add(pick(groups[c]), pick(groups[c + 1]), "-->");
  const extra = 3 + Math.floor(rand() * 6);
  for (let k = 0; k < extra; k++) {
    const kind = rand();
    const arrow = pick(["-->", "-->", "-->", "<-->", "-.->", "==>"]);
    const c = Math.floor(rand() * groups.length);
    if (kind < 0.55) add(pick(nodes), pick(nodes), arrow);
    else if (kind < 0.7) add(`G${c}`, pick(outside(c)), arrow);
    else if (kind < 0.85) add(pick(outside(c)), `G${c}`, arrow);
    else add(`G${c}`, `G${(c + 1 + Math.floor(rand() * (groups.length - 1))) % groups.length}`, arrow);
  }
  return [...lines, ...edges].join(NEWLINE) + NEWLINE;
}

const GENERATED_SEEDS = 24;

const GENERATED_SOURCES: readonly Source[] = Array.from({ length: GENERATED_SEEDS }, (_, i) => ({
  name: `generated:${i + 1}`,
  source: generatedSource(i + 1),
  rungs: LIGHT_RUNGS,
}));

const FAN = (s1: string, s2: string, s3: string): string => `flowchart
    A[a] ${s1} X[x]
    A ${s1} Y[y]
    B[b] ${s2} X
    B ${s2} Y
    C[c] ${s3} X
    C ${s3} Z[z]
    B ${s2} Z
`;

const LOOP = `graph
    A[Start] --> B{Check}
    B -->|ok| C[Work]
    B -->|ko| A
    C --> D{Again?}
    D -->|yes| B
    D -->|no| E[End]
`;

const HAND_SOURCES: readonly Source[] = [
  { name: "fan:plain", source: FAN("-->", "-->", "-->") },
  { name: "fan:dotted", source: FAN("-.->", "-.->", "-.->") },
  { name: "fan:thick", source: FAN("==>", "==>", "==>") },
  { name: "fan:mixed", source: FAN("-->", "-.->", "==>") },
  { name: "loop", source: LOOP },
  { name: "loop:LR", source: LOOP.replace("graph", "graph LR") },
];

const FLOWCHART_RE = /^\s*(flowchart|graph)\b/mu;

// Every flowchart of the corpus, named from inside `fixtures/` (`flowchart/glyph-widths.mmd`).
const flowchartSources = (): Source[] =>
  corpus(EVERY)
    .filter(({ source }) => FLOWCHART_RE.test(source))
    .map(({ at, source }) => ({ name: at.slice(FIXTURES.length + 1), source }));

export const SOURCES: readonly Source[] = [...HAND_SOURCES, ...flowchartSources(), ...GENERATED_SOURCES];
