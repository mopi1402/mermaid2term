import type { Commit, GitGraph } from "./model.js";
import { LINK_RANK, SPINE_RANK, Wires } from "./wires.js";
import { must } from "../../must.js";
import { GIT_LINE_PREFIX, GIT_SPINE, indexed } from "../../canvas/keys.js";
import { sortedBranches } from "./order.js";
import { slotsOf } from "./slots.js";

// Where a graph stands, whatever its direction: `along` is the axis commits follow, `across` the one branches
// stack on, and `cell` turns the pair into a canvas row and column.
export interface Frame {
  across: ReadonlyMap<string, number>;
  along: ReadonlyMap<string, number>;
  forward: number;
  lineStart: number;
  cell(along: number, across: number): readonly [number, number];
  // Where an arrow sent round between two branches runs, across: the `index`th lane of that room.
  lane(from: number, to: number, index: number): number;
  lanes: ReadonlyMap<string, Lane>;
}

export interface Lane {
  room: number;
  index: number;
  count: number;
}

type InkOf = (branch: string) => string;

// How far every branch line runs past the last step: a cherry two cells wide still has line after it.
export const TRAIL = 3;

function run(wires: Wires, frame: Frame, across: number, from: number, to: number, key: string, rank = LINK_RANK): void {
  const [r1, c1] = frame.cell(from, across);
  const [r2, c2] = frame.cell(to, across);
  wires.segment(r1, c1, r2, c2, key, rank);
}

function rise(wires: Wires, frame: Frame, along: number, from: number, to: number, key: string): void {
  const [r1, c1] = frame.cell(along, from);
  const [r2, c2] = frame.cell(along, to);
  wires.segment(r1, c1, r2, c2, key);
}

// A branch's own line, from its first commit to one cell past its last; with `showBranches` off mermaid draws
// no branch line at all, only the arrows between commits. Between its commits the line is their arrows, in the
// branch's ink; outside them it is the bare `.branch` spine.
function branchLines(diagram: GitGraph, frame: Frame, wires: Wires, ink: InkOf): void {
  // mermaid runs every `.branch` line the whole width of the graph, past the last commit of any branch.
  const steps = diagram.commits.map((commit) => must(frame.along.get(commit.key)));
  const furthest = frame.forward > 0 ? Math.max(...steps) : Math.min(...steps);
  for (const branch of diagram.branches) {
    const commits = diagram.commits.filter((commit) => commit.branch === branch.name);
    const first = commits[0];
    const last = commits[commits.length - 1];
    if (first === undefined || last === undefined) continue;
    const across = must(frame.across.get(branch.name));
    const start = diagram.showBranches ? frame.lineStart : must(frame.along.get(first.key));
    const [head, tail] = [must(frame.along.get(first.key)), must(frame.along.get(last.key))];
    const end = diagram.showBranches ? furthest + frame.forward * TRAIL : tail;
    if (start !== head) run(wires, frame, across, start, head, GIT_SPINE, SPINE_RANK);
    if (head !== tail) run(wires, frame, across, head, tail, ink(branch.name));
    if (end !== tail) run(wires, frame, across, tail, end, GIT_SPINE, SPINE_RANK);
  }
}

// mermaid bends a merge's second parent at the merge, along the merged branch; every other arrow leaves its
// parent's step and runs along the child's branch (`drawArrow`, 11.17.0), in the ink of the branch it runs along.
// `shouldRerouteArrow`: a commit between the two, on the branch the bend would run along, sends the arrow round.
function detoured(commits: readonly Commit[], parent: Commit, child: Commit, seatOf: (branch: string) => number): boolean {
  const bentOn = seatOf(parent.branch) < seatOf(child.branch) ? child.branch : parent.branch;
  const [first, last] = [commits.indexOf(parent), commits.indexOf(child)];
  return commits.some((commit, seq) => seq > first && seq < last && commit.branch === bentOn);
}

const detourKey = (parent: Commit, child: Commit): string => `${parent.key}>${child.key}`;

// mermaid `findLane`: an arrow sent round never runs along another's lane. Arrows whose lanes fall in the same room
// (`roomOf` the two branches' seats) and whose steps overlap each take the next lane.
export function lanesOf(diagram: GitGraph, roomOf: (from: number, to: number) => number): Map<string, Lane> {
  const seats = new Map(sortedBranches(diagram).map((name, i) => [name, i]));
  const seatOf = (branch: string): number => must(seats.get(branch));
  const slots = slotsOf(diagram);
  const byKey = new Map(diagram.commits.map((commit) => [commit.key, commit]));
  const claims: { room: number; index: number; start: number; end: number }[] = [];
  const lanes = new Map<string, Lane>();
  for (const child of diagram.commits) {
    for (const id of child.parents) {
      const parent = byKey.get(id);
      if (parent === undefined || parent.branch === child.branch || !detoured(diagram.commits, parent, child, seatOf)) continue;
      const room = roomOf(seatOf(parent.branch), seatOf(child.branch));
      const [start, end] = [must(slots.get(parent.key)), must(slots.get(child.key))];
      const taken = (index: number): boolean => claims.some((claim) => claim.room === room && claim.index === index && claim.start <= end && start <= claim.end);
      let index = 0;
      while (taken(index)) index += 1;
      claims.push({ room, index, start, end });
      lanes.set(detourKey(parent, child), { room, index, count: 0 });
    }
  }
  for (const lane of lanes.values()) lane.count = Math.max(...claims.filter((claim) => claim.room === lane.room).map((claim) => claim.index)) + 1;
  return lanes;
}

function connector(frame: Frame, wires: Wires, parent: Commit, child: Commit, ink: InkOf): void {
  const from = must(frame.across.get(parent.branch));
  const to = must(frame.across.get(child.branch));
  if (from === to) return;
  const start = must(frame.along.get(parent.key));
  const end = must(frame.along.get(child.key));
  // Sent round by a lane of its own, in the parent's ink where the parent stands the further across.
  const detour = frame.lanes.get(detourKey(parent, child));
  if (detour !== undefined) {
    const lane = frame.lane(from, to, detour.index);
    const key = from > to || (child.origin === "merge" && parent.key !== child.parents[0]) ? ink(parent.branch) : ink(child.branch);
    rise(wires, frame, start, from, lane, key);
    run(wires, frame, lane, start, end, key);
    rise(wires, frame, end, lane, to, key);
    return;
  }
  if (child.origin === "merge" && parent.key !== child.parents[0]) {
    run(wires, frame, from, start, end, ink(parent.branch));
    rise(wires, frame, end, from, to, ink(parent.branch));
    return;
  }
  rise(wires, frame, start, from, to, ink(child.branch));
  run(wires, frame, to, start, end, ink(child.branch));
}

export function wiring(diagram: GitGraph, frame: Frame): Wires {
  const wires = new Wires(frame.cell(0, 0)[0] === frame.cell(1, 0)[0]);
  const seats = new Map(sortedBranches(diagram).map((name, i) => [name, i]));
  const ink: InkOf = (branch) => indexed(GIT_LINE_PREFIX, must(seats.get(branch)));
  branchLines(diagram, frame, wires, ink);
  const byKey = new Map(diagram.commits.map((commit) => [commit.key, commit]));
  for (const commit of diagram.commits) {
    for (const parentId of commit.parents) {
      const parent = byKey.get(parentId);
      if (parent !== undefined) connector(frame, wires, parent, commit, ink);
    }
  }
  return wires;
}
