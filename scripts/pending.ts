export type Check = "merges" | "arrows" | "pierced";

export interface Pending {
  checks: readonly Check[];
  why: string;
}

const SEED_RED = "red when the generator was added (2026-09-12); the seed is struck off the turn it turns green";
const seed = (n: number, ...checks: Check[]): [string, Pending] => [`generated:${n}`, { checks, why: SEED_RED }];

export const PENDING: ReadonlyMap<string, Pending> = new Map<string, Pending>([
  [
    "flowchart/glyph-widths.mmd",
    { checks: ["arrows"], why: "the `\u25B2` a node is NAMED after is read as a head, and the box under it as the line that should feed it (2026-09-20)" },
  ],
  [
    "flowchart/cluster-lanes-lr.stress.mmd",
    { checks: ["merges"], why: "`C --> F` turns down onto the row `D --> F` runs on into F and the two share their last five cells, default borders, LR and RL (2026-10-18)" },
  ],
  seed(3, "arrows"),
  seed(4, "merges"),
  seed(14, "merges"),
  seed(15, "merges", "arrows", "pierced"),
  seed(18, "merges"),
  seed(24, "merges"),
]);

export const isPending = (name: string, check: Check): boolean => PENDING.get(name)?.checks.includes(check) ?? false;

