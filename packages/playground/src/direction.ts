import { declaredType } from "@tayomi/mermaid2term";

const HEADINGS = ["TB", "LR", "RL", "BT"] as const;
export type Heading = (typeof HEADINGS)[number];

interface Grammar {
  options: readonly Heading[];
  place: "header" | "line";
  tbWord: string;
  suffix: string;
}

const HEADER_4: Grammar = { options: HEADINGS, place: "header", tbWord: "TB", suffix: "" };
const LINE_4: Grammar = { options: HEADINGS, place: "line", tbWord: "TB", suffix: "" };

const GRAMMARS: Record<string, Grammar> = {
  flowchart: HEADER_4,
  stateDiagram: LINE_4,
  classDiagram: LINE_4,
  erDiagram: LINE_4,
  gitGraph: { options: ["TB", "LR", "BT"], place: "header", tbWord: "TB", suffix: ":" },
  timeline: { options: ["TB", "LR"], place: "header", tbWord: "TD", suffix: "" },
};

export const headingOf = (word: string): Heading | undefined => {
  const upper = word.toUpperCase();
  return HEADINGS.find((heading) => heading === (upper === "TD" ? "TB" : upper));
};

export interface Direction {
  options: readonly Heading[];
  current: Heading | undefined;
}

function headerLine(lines: string[]): number {
  let i = 0;
  if ((lines[0] ?? "").trim() === "---") {
    i = 1;
    while (i < lines.length && (lines[i] ?? "").trim() !== "---") i++;
    i++;
  }
  for (; i < lines.length; i++) {
    const bare = (lines[i] ?? "").trim();
    if (bare === "" || bare.startsWith("%%")) continue;
    return i;
  }
  return -1;
}

const headerWords = (line: string): string[] =>
  line
    .trim()
    .replace(/;$/u, "")
    .replace(/(TB|TD|LR|RL|BT)\s*:/iu, "$1 :")
    .split(/\s+/u)
    .filter((word) => word !== "");

function directionLine(lines: string[], from: number): number {
  let depth = 0;
  for (let i = from + 1; i < lines.length; i++) {
    const bare = (lines[i] ?? "").trim();
    if (depth === 0 && /^direction\s+(TB|TD|LR|RL|BT)\s*$/iu.test(bare)) return i;
    for (const character of bare) {
      if (character === "{") depth++;
      else if (character === "}") depth = Math.max(0, depth - 1);
    }
  }
  return -1;
}

export function readDirection(source: string): Direction | undefined {
  const type = declaredType(source);
  const grammar = type === undefined ? undefined : GRAMMARS[type];
  if (grammar === undefined) return undefined;
  const lines = source.split("\n");
  const header = headerLine(lines);
  if (header === -1) return undefined;

  if (grammar.place === "header") {
    const words = headerWords(lines[header]);
    const second = words[1] ?? "";
    const current = headingOf(second);
    return { options: grammar.options, current: current !== undefined && grammar.options.includes(current) ? current : undefined };
  }
  const line = directionLine(lines, header);
  if (line === -1) return { options: grammar.options, current: undefined };
  const word = lines[line].trim().split(/\s+/u)[1];
  return { options: grammar.options, current: headingOf(word) };
}

function indentation(lines: string[], header: number): string {
  for (let i = header + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") continue;
    return /^\s*/u.exec(line)?.[0] ?? "";
  }
  return "    ";
}

export function writeDirection(source: string, heading: Heading | undefined): string {
  const type = declaredType(source);
  const grammar = type === undefined ? undefined : GRAMMARS[type];
  if (grammar === undefined) return source;
  const lines = source.split("\n");
  const header = headerLine(lines);
  if (header === -1) return source;
  const word = heading === undefined ? undefined : heading === "TB" ? grammar.tbWord : heading;

  if (grammar.place === "header") {
    const raw = lines[header];
    const margin = /^\s*/u.exec(raw)?.[0] ?? "";
    const semicolon = /;\s*$/u.test(raw) ? ";" : "";
    const words = headerWords(raw);
    const keyword = words[0];
    let rest = words.slice(1);
    if (headingOf(rest[0] ?? "") !== undefined) rest = rest.slice(1);
    if ((rest[0] ?? "") === ":") rest = rest.slice(1);
    const rewritten = word === undefined ? [keyword, ...rest] : [keyword, `${word}${grammar.suffix}`, ...rest];
    lines[header] = `${margin}${rewritten.join(" ")}${semicolon}`;
    return lines.join("\n");
  }

  const line = directionLine(lines, header);
  if (word === undefined) {
    if (line !== -1) lines.splice(line, 1);
    return lines.join("\n");
  }
  if (line !== -1) {
    const margin = /^\s*/u.exec(lines[line])?.[0] ?? "";
    lines[line] = `${margin}direction ${word}`;
    return lines.join("\n");
  }
  lines.splice(header + 1, 0, `${indentation(lines, header)}direction ${word}`);
  return lines.join("\n");
}
