import { declaredType } from "@tayomi/mermaid2term";

export const BOM = "bom";
const BOM_FILE = `/${BOM}`;

// The sources that open on a byte order mark, one per kind and named after it, read as a family of their own.
export const familyOf = (name: string, source: string): string =>
  name.endsWith(BOM_FILE) ? BOM : (declaredType(source) ?? "other");

const FAMILY_LABELS: Record<string, string> = {
  architecture: "Architecture",
  block: "Block",
  bom: "BOM",
  classDiagram: "Class",
  erDiagram: "Entity Relationship",
  flowchart: "Flowchart",
  gantt: "Gantt",
  gitGraph: "Git",
  journey: "Journey",
  kanban: "Kanban",
  mindmap: "Mindmap",
  packet: "Packet",
  pie: "Pie",
  quadrantChart: "Quadrant",
  sequenceDiagram: "Sequence",
  stateDiagram: "State",
  timeline: "Timeline",
  treemap: "Treemap",
  xychart: "XY Chart",
};

export const familyLabel = (name: string): string =>
  FAMILY_LABELS[name] ?? name.charAt(0).toUpperCase() + name.slice(1);

const ACRONYMS = new Map(
  Object.entries({
    ci: "CI",
    cd: "CD",
    http: "HTTP",
    oauth: "OAuth",
    udp: "UDP",
    mvc: "MVC",
    lr: "LR",
    tb: "TB",
    td: "TD",
    bt: "BT",
    rl: "RL",
    id: "ID",
    ids: "IDs",
    br: "BR",
    bom: "BOM",
  })
);

const FAMILY_PREFIXES: Record<string, string[]> = {
  architecture: ["architecture"],
  block: ["block"],
  bom: ["bom"],
  classDiagram: ["class"],
  erDiagram: ["er"],
  flowchart: ["flowchart"],
  gantt: ["gantt"],
  gitGraph: ["gitgraph", "git"],
  journey: ["journey"],
  kanban: ["kanban"],
  mindmap: ["mindmap"],
  packet: ["packet"],
  pie: ["pie"],
  quadrantChart: ["quadrant"],
  sequenceDiagram: ["sequence", "seq"],
  stateDiagram: ["state"],
  timeline: ["timeline"],
  treemap: ["treemap"],
  xychart: ["xychart"],
};

const CONJUNCTIONS = new Set(["and", "or", "of"]);

// A fixture's name is its kind's folder and its file, `flowchart/node-shapes`: the label reads the file alone.
export const labelOf = (name: string, declaredFamily: string): string => {
  let rest = name.slice(name.lastIndexOf("/") + 1);
  for (const prefix of FAMILY_PREFIXES[declaredFamily] ?? []) {
    if (rest !== prefix && rest.startsWith(`${prefix}-`)) {
      rest = rest.slice(prefix.length + 1);
      break;
    }
  }
  const words: string[] = [];
  for (const word of rest.split("-")) {
    const last = words[words.length - 1];
    if (last !== undefined && /^\d+$/.test(word) && /\d$/.test(last)) words[words.length - 1] = `${last}.${word}`;
    else if (last === "CI" && word === "cd") words[words.length - 1] = "CI/CD";
    else if (last === "e" && word === "commerce") words[words.length - 1] = "E-Commerce";
    else if ((last === "y" || last === "x") && word === "axis")
      words[words.length - 1] = `${last.toUpperCase()}-Axis`;
    else words.push(ACRONYMS.get(word) ?? word);
  }
  return words
    .map((word) => (/^[a-z]/.test(word) && !CONJUNCTIONS.has(word) ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ");
};
