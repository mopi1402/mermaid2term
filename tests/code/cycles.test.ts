import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ROOT, reaches, sources } from "../support/sources.js";

const TREES = ["src", "scripts", "tests", join("packages", "playground", "src"), join("packages", "playground", "tests")];
const ALIAS = join(ROOT, "packages", "playground", "src");

const targetOf = (from: string, where: string): string | undefined => {
  const base = where.startsWith("@/") ? join(ALIAS, where.slice(2)) : resolve(dirname(from), where.replace(/\.js$/u, ""));
  return [`${base}.ts`, `${base}.tsx`, join(base, "index.ts")].find((one) => existsSync(one));
};

type Graph = Map<string, Set<string>>;

const graphs = (): { values: Graph; everything: Graph } => {
  const values: Graph = new Map();
  const everything: Graph = new Map();
  for (const tree of TREES) {
    for (const file of sources(join(ROOT, tree))) {
      const reads = new Set<string>();
      const all = new Set<string>();
      for (const reach of reaches(readFileSync(file, "utf8"), file)) {
        if (!reach.module.startsWith(".") && !reach.module.startsWith("@/")) continue;
        const target = targetOf(file, reach.module);
        if (target === undefined) continue;
        all.add(target);
        if (!reach.typesOnly) reads.add(target);
      }
      values.set(file, reads);
      everything.set(file, all);
    }
  }
  return { values, everything };
};

const knots = (graph: Graph): string[][] => {
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const seated = new Set<string>();
  const found: string[][] = [];
  let next = 0;

  const visit = (node: string): void => {
    index.set(node, next);
    low.set(node, next);
    next += 1;
    stack.push(node);
    seated.add(node);
    for (const to of graph.get(node) ?? []) {
      if (!index.has(to)) {
        visit(to);
        low.set(node, Math.min(low.get(node) ?? 0, low.get(to) ?? 0));
      } else if (seated.has(to)) {
        low.set(node, Math.min(low.get(node) ?? 0, index.get(to) ?? 0));
      }
    }
    if (low.get(node) !== index.get(node)) return;
    const group: string[] = [];
    for (;;) {
      const off = stack.pop();
      if (off === undefined) break;
      seated.delete(off);
      group.push(off);
      if (off === node) break;
    }
    if (group.length > 1) found.push(group.sort());
  };

  for (const node of graph.keys()) if (!index.has(node)) visit(node);
  return found;
};

const named = (group: string[]): string => group.map((file) => relative(ROOT, file)).join(" <-> ");

describe("nothing imports itself, however long the way round", () => {
  const { values, everything } = graphs();

  it("finds no cycle among the imports that RUN", () => {
    expect(knots(values).map(named)).toEqual([]);
  });

  it("finds no cycle among the types either, which is the same fault before it bites", () => {
    expect(knots(everything).map(named)).toEqual([]);
  });
});
