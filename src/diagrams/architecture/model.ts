import type { Graph, Subgraph } from "../../graph/model.js";

export const SIDES = ["L", "R", "T", "B"] as const;
export type Side = (typeof SIDES)[number];

export interface Hint {
  readonly source: string;
  readonly sourceSide: Side;
  readonly target: string;
  readonly targetSide: Side;
  readonly headAtSource: boolean;
  readonly headAtTarget: boolean;
}

// What a seat is read from: `target` stands one cell off `source` toward `side`, or further for an `align` member.
export type Seat = readonly [source: string, side: Side, target: string, loose?: boolean];

// What the statements say before any seat is chosen: the graph, the seats the hinted edges and the `align` lines
// ask for, every node in the order it was written, and the junctions.
export interface ArchitectureModel {
  readonly graph: Graph;
  readonly groups: ReadonlyMap<string, Subgraph>;
  readonly hints: readonly Hint[];
  readonly aligned: readonly Seat[];
  readonly nodeIds: string[];
  readonly junctionIds: ReadonlySet<string>;
}
