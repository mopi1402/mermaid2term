import { isHorizontal, isSelfReference, normalized, type Edge, type Graph } from "../model.js";
import { pushInto } from "../../must.js";
import { type GridLayout } from "../layout/grid.js";
import { laneId, type CellSet } from "./pathfinder.js";
import { AttachDir } from "../sides.js";
import { type RoutedEdge } from "./routed.js";
import { clipEndpointToBox, resolveEndpoints, straightenMarkToBox } from "./endpoints.js";
import { computeSgRegions, foreignSgCells } from "./regions.js";
import { type SeatCount, routeEdge, routeSelfEdge } from "./one-edge.js";
import { loopNests, seatNestedLoops } from "../self-loops.js";
import { countFans, fansAt, routingOrder } from "./fans.js";
import { membersOf, boxesUnder } from "../subgraph-tree.js";
import { STEM_CELLS, type Kin, arrivesAt, lanesFor, lanesOf, leavesFrom, remember, stemInto, stemOut } from "./lanes.js";
import { drumWallsOf, spreadSharedEndpoints } from "./spread.js";
import { liftSharedCorners, partSharedTurns, unbraidSharedRuns } from "./lift.js";
import { airRunsOffWalls, partClusterRuns, slideClusterEnds } from "./clusters.js";
import { seatFrameLinksOutside } from "./frame-seats.js";
import { airLabelsUp, slideOffHeads } from "./heads.js";
import { centreElbows, flattenSteps, retreatCrampedElbows, straightenDetours } from "./elbows.js";
import { settleEdge, settleMarkPaths } from "./settle.js";

function kinOf(graph: Graph): Kin {
  const reach = (id: string, isFrame: boolean): Set<string> => {
    const frame = isFrame ? graph.findSubgraphById(id) : undefined;
    return frame === undefined ? new Set([id]) : new Set([id, ...membersOf(frame), ...boxesUnder(frame).map((sg) => sg.id)]);
  };
  const ends = (edge: Edge): Set<string> => new Set([...reach(edge.source, edge.sourceIsSubgraph), ...reach(edge.target, edge.targetIsSubgraph)]);
  return (a, b) => {
    const theirs = ends(b);
    return [...ends(a)].some((id) => theirs.has(id));
  };
}

export function routeEdges(graph: Graph, layout: GridLayout, upward = false): RoutedEdge[] {
  const direction = normalized(graph.direction);
  const routed: RoutedEdge[] = [];
  const softObstacles = new Set<string>();
  const lanes = new Map<string, number>();
  const riders = new Map<string, Edge[]>();
  const kin = kinOf(graph);
  const spread = new Map<string, string[]>();

  const sgBounds = layout.frames();
  const regions = computeSgRegions(layout, sgBounds);
  const horizontal = isHorizontal(direction);
  const fan = countFans(graph, layout);
  const settled = settleMarkPaths(graph, layout, horizontal, sgBounds);
  const wallsOf = drumWallsOf(graph, layout);

  const drawn = new Array<RoutedEdge | undefined>(graph.edges.length).fill(undefined);
  const seated = new Map<string, SeatCount>();
  const seatOf = (nodeId: string, dir: AttachDir): SeatCount => {
    const key = `${nodeId}:${dir}`;
    const seat = seated.get(key) ?? { arrivals: 0, hasDeparture: false };
    seated.set(key, seat);
    return seat;
  };

  // A fan's legs reach their boxes where the boxes are entered; only a mark's one run is laid flat on its lane.
  const nests = loopNests(graph);
  const exits = new Map<string, number>();
  for (const e of graph.edges) if (!isSelfReference(e)) exits.set(e.source, (exits.get(e.source) ?? 0) + 1);

  for (const index of routingOrder(graph, layout, fan, horizontal)) {
    const edge = graph.edges[index];
    const [src, tgt] = resolveEndpoints(graph, edge, layout, sgBounds, horizontal);
    if (src === undefined || tgt === undefined) continue;

    if (isSelfReference(edge) && !edge.sourceIsSubgraph) {
      const re = routeSelfEdge(edge, src, layout, horizontal, nests.get(index));
      re.index = index;
      drawn[index] = re;
      continue;
    }

    const forbidden = foreignSgCells(edge, graph, regions);
    const { held, kinCells } = lanesFor(edge, lanes, spread, riders, kin);
    const obstacles: CellSet = { has: (cell) => (softObstacles.has(cell) && !kinCells.has(cell)) || forbidden.has(cell) };
    const at = fansAt(edge, src, tgt, fan, horizontal);
    const chosen = settled.get(index);
    const re =
      chosen !== undefined
        ? settleEdge(graph, edge, src, tgt, layout, chosen)
        : routeEdge(edge, src, tgt, layout, direction, obstacles, held, at, seated, wallsOf);
    re.index = index;
    seatOf(edge.source, re.startDir).hasDeparture = true;
    seatOf(edge.target, re.endDir).arrivals += 1;
    for (const cell of re.occupiedCells) softObstacles.add(cell);
    for (const lane of lanesOf(re.gridPath)) {
      lanes.set(lane, (lanes.get(lane) ?? 0) + 1);
      pushInto(riders, lane, edge);
    }
    const movable = re.gridPath.length >= 3;
    const arriving = lanesOf(re.gridPath, re.gridPath.length - 1);
    remember(spread, arrivesAt(edge.target), arriving);
    remember(spread, stemInto(edge.target), movable ? arriving : arriving.slice(-STEM_CELLS));
    const turn = re.gridPath[re.gridPath.length - 2];
    const before = re.gridPath[re.gridPath.length - 3];
    if (turn !== undefined && before !== undefined) {
      const corner = laneId(turn[0], turn[1], before[1] === turn[1]);
      remember(spread, arrivesAt(edge.target), [corner]);
      remember(spread, stemInto(edge.target), [corner]);
    }
    const leaving = lanesOf(re.gridPath, 1, 1);
    remember(spread, leavesFrom(edge.source), leaving);
    remember(spread, stemOut(edge.source), movable ? leaving : leaving.slice(0, STEM_CELLS));

    const sourceBox = sgBounds.get(edge.source);
    if (edge.sourceIsSubgraph && sourceBox !== undefined) {
      clipEndpointToBox(re.drawPath, sourceBox, true);
      if (tgt.mark) {
        re.drawPath.reverse();
        straightenMarkToBox(re.drawPath, sourceBox, horizontal, layout);
        re.drawPath.reverse();
      }
    }
    const targetBox = sgBounds.get(edge.target);
    if (edge.targetIsSubgraph && targetBox !== undefined) {
      clipEndpointToBox(re.drawPath, targetBox, false);
      if (src.mark && (exits.get(edge.source) ?? 0) === 1) straightenMarkToBox(re.drawPath, targetBox, horizontal, layout);
    }

    drawn[index] = re;
  }

  for (const re of drawn) if (re !== undefined) routed.push(re);

  spreadSharedEndpoints(routed, layout, sgBounds, wallsOf);
  liftSharedCorners(routed, layout, sgBounds);
  partSharedTurns(routed, layout, sgBounds);
  partClusterRuns(routed, layout, sgBounds, wallsOf);
  slideClusterEnds(routed, layout, sgBounds);
  seatFrameLinksOutside(routed, layout, sgBounds, wallsOf);
  unbraidSharedRuns(routed, layout, sgBounds);
  retreatCrampedElbows(routed, layout, sgBounds);
  straightenDetours(routed, layout);
  flattenSteps(routed, layout, sgBounds, kin);
  centreElbows(routed, layout, !horizontal);
  airRunsOffWalls(routed, layout, sgBounds);
  slideOffHeads(routed, layout, sgBounds);
  if (upward) airLabelsUp(routed, layout, sgBounds);
  seatNestedLoops(routed, layout, nests);
  return routed;
}

