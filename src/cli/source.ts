import fs from "node:fs";
import { declaredType, parse } from "../index.js";
import { MINDMAP } from "../diagrams/mindmap/kind.js";
import { mindmapWithIds } from "../diagrams/mindmap/parser.js";
import { KANBAN } from "../diagrams/kanban/kind.js";
import { kanbanWithIds } from "../diagrams/kanban/parser.js";
import { withoutBom } from "../source/source.js";
import { QUOTE, SAFE_QUOTE } from "../source/quotes.js";
import { messageOf } from "../text/format.js";
import { NEWLINE } from "../text/chars.js";
import { PROGRAM, err } from "./exits.js";
import type { Args } from "./args.js";

// A pipe's descriptor is non-blocking once the stream exists, so a sync read of it fails with EAGAIN on a slow writer.
async function readStdin(): Promise<string> {
  process.stdin.setEncoding("utf8");
  let text = "";
  for await (const chunk of process.stdin) text += String(chunk);
  return text;
}

export async function readSource(args: Args): Promise<string | undefined> {
  if (args.file !== undefined) {
    try {
      return fs.readFileSync(args.file, "utf8");
    } catch (e) {
      if (e instanceof Error && "code" in e && e.code === "ENOENT") err(`Error: File not found: ${args.file}`);
      else err(`Error reading file: ${messageOf(e)}`);
      return undefined;
    }
  }
  if (process.stdin.isTTY !== true) {
    try {
      return await readStdin();
    } catch (e) {
      err(`Error reading input: ${messageOf(e)}`);
      return undefined;
    }
  }
  err("Error: No input provided. Pass a file or pipe input.");
  err(`Usage: ${PROGRAM} diagram.mmd`);
  err(`       echo 'graph LR; A-->B' | ${PROGRAM}`);
  return undefined;
}


// The kinds that spell their ids their own way; every other one is read as a graph.
const WITH_IDS: ReadonlyMap<string, (source: string) => string> = new Map([
  [MINDMAP.prefix, mindmapWithIds],
  [KANBAN.prefix, kanbanWithIds],
]);

export function applyShowIds(source: string): string {
  const own = WITH_IDS.get(declaredType(source) ?? "");
  if (own !== undefined) return own(source);
  let graph;
  try {
    graph = parse(source);
  } catch {
    return source;
  }

  const extra: string[] = [];
  for (const [id, node] of graph.nodes) {
    if (node.label !== id) extra.push(`  ${id}["${`${id}: ${node.label}`.replaceAll(QUOTE, SAFE_QUOTE)}"]`);
  }
  if (extra.length === 0) return source;

  // Written LAST, because the last label spelled for a node is the one drawn: put ahead of the body, every
  // `A["A: Start"]` would be overwritten by the `A[Start]` that follows it.
  return [...withoutBom(source).trim().split(NEWLINE), ...extra].join(NEWLINE);
}
