import fs from "node:fs";
import { declaredType, parse } from "../index.js";
import { withoutBom } from "../source/source.js";
import { QUOTE, SAFE_QUOTE } from "../source/quotes.js";
import { messageOf } from "../text/format.js";
import { NEWLINE } from "../text/chars.js";
import { PROGRAM, err } from "./exits.js";
import type { Args } from "./args.js";

export function readSource(args: Args): string | undefined {
  if (args.file !== undefined) {
    try {
      return fs.readFileSync(args.file, "utf8");
    } catch (e) {
      if (e instanceof Error && "code" in e && e.code === "ENOENT") err(`Error: File not found: ${args.file}`);
      else err(`Error reading file: ${messageOf(e)}`);
      return undefined;
    }
  }
  if (process.stdin.isTTY !== true) return fs.readFileSync(0, "utf8");
  err("Error: No input provided. Pass a file or pipe input.");
  err(`Usage: ${PROGRAM} diagram.mmd`);
  err(`       echo 'graph LR; A-->B' | ${PROGRAM}`);
  return undefined;
}


// The kinds that spell their ids their own way; every other one is read as a graph.
const WITH_IDS: ReadonlyMap<string, (source: string) => string> = new Map();

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
