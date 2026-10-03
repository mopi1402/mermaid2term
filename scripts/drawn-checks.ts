import { isMainThread } from "node:worker_threads";
import { RUNGS, badlyFedHeads, mergedCells, piercedHeads, rungOf } from "../tests/invariants/geometry.js";
import { PENDING, isPending } from "./pending.js";
import { pooled, serve } from "./pool.js";
import { SOURCES, drawingsOf, type Source } from "./sources.js";

// What one check says over the drawings: its pending notes, the report of each faulty drawing, and the count.
export interface Verdict {
  readonly pending: string[];
  readonly report: string[];
  defects: number;
}

interface Found {
  readonly report: string[];
  defects: number;
}

const unfed = (name: string): boolean => isPending(name, "arrows");
const unalone = (name: string): boolean => isPending(name, "pierced");
const unmerged = (name: string): boolean => isPending(name, "merges");

function checked({ name, ...source }: Source): { arrows: Found; merges: Found } {
  const arrows: Found = { report: [], defects: 0 };
  const merges: Found = { report: [], defects: 0 };
  if (unfed(name) && unalone(name) && unmerged(name)) return { arrows, merges };
  for (const d of drawingsOf({ name, ...source })) {
    const bad = [...(unfed(name) ? [] : badlyFedHeads(d.canvas)), ...(unalone(name) ? [] : piercedHeads(d.canvas))];
    if (bad.length > 0) {
      arrows.defects += bad.length;
      arrows.report.push(`${name} ${rungOf(d)}:`, ...bad.map((line) => `  ${line}`), d.canvas.toString());
    }
    const merged = unmerged(name) ? [] : mergedCells(d);
    if (merged.length > 0) {
      merges.defects += merged.length;
      merges.report.push(`${name} ${rungOf(d)}:`, ...merged.map((line) => `  ${line}`), d.canvas.toString());
    }
  }
  return { arrows, merges };
}

if (!isMainThread) serve((at) => checked(SOURCES[at]));

// arrows and merges read the very same drawings: one pass draws them once and settles both.
export async function drawnChecks(): Promise<{ arrows: Verdict; merges: Verdict }> {
  const arrows: Verdict = { pending: [], report: [], defects: 0 };
  const merges: Verdict = { pending: [], report: [], defects: 0 };
  for (const { name } of SOURCES) {
    const fed = !unfed(name);
    const alone = !unalone(name);
    if (!fed || !alone) arrows.pending.push(`pending ${name} (${[!fed && "fed", !alone && "pierced"].filter(Boolean).join(", ")}): ${PENDING.get(name)?.why}`);
    if (unmerged(name)) merges.pending.push(`pending ${name}: ${PENDING.get(name)?.why}`);
  }
  const found = await pooled<ReturnType<typeof checked>>(new URL(import.meta.url), SOURCES.map(({ source, rungs }) => source.length * (rungs ?? RUNGS).length));
  for (const f of found) {
    arrows.report.push(...f.arrows.report);
    arrows.defects += f.arrows.defects;
    merges.report.push(...f.merges.report);
    merges.defects += f.merges.defects;
  }
  return { arrows, merges };
}

export function told(v: Verdict, summary: string): void {
  for (const line of v.pending) console.log(line);
  for (const line of v.report) console.error(line);
  if (v.defects === 0) return;
  console.error(`\n${v.defects} ${summary}`);
  process.exit(2);
}
