import { Direction, Graph, directionOf, makeEdge, type Node, type Subgraph } from "../../graph/model.js";
import { NEWLINE } from "../../text/chars.js";
import { statementsOf, uncommented, words } from "../../source/lines.js";
import { joinedBlocks } from "../../source/shape-data.js";
import { maskQuotes } from "../../source/quotes.js";
import { readClick } from "../@common/click.js";
import { resolveClusterEdges } from "../../graph/clusters.js";
import { withoutAccessible } from "../@common/accessible.js";
import { DIRECTION_ANYWHERE_RE } from "../@common/box-diagram.js";
import { splitByArrows } from "./arrows.js";
import { EDGE_ID_RE } from "./patterns.js";
import { splitAmpersand } from "./segments.js";
import { readNode } from "./shapes.js";
import { lineLabel } from "../../text/labels.js";
import { collapseGroups, openSubgraph, readDirectionOverride, registerInSubgraph } from "./subgraphs.js";
import { readStyle } from "../@common/styles.js";
import { dressLinks, dressSubgraphs, dropMarkers, readClassAssignment, readClassDef, readLinkStyle } from "./styles.js";

const HEADER_KEYWORDS = ["graph", "flowchart", "flowchart-elk"];
const LEGACY_DIRECTIONS: ReadonlyMap<string, Direction> = new Map([
  ["<", Direction.RL],
  [">", Direction.LR],
  ["^", Direction.BT],
  ["v", Direction.TB],
]);

class FlowchartParser {
  private readonly graph = new Graph();
  private readonly subgraphStack: Subgraph[] = [];
  private readonly shapedNodeIds = new Set<string>();
  private readonly edgeIds = new Set<string>();
  private readonly edgeIndexById = new Map<string, number>();
  private readonly linkClasses: Array<readonly [string, string]> = [];

  constructor(private readonly text: string) {}

  parse(): Graph {
    const lines = this.preprocess(this.text);
    const header = lines[0];
    if (header === undefined) return this.graph;
    // The link names ALL read first: `e1@{ animate: true }` is spelled exactly as a node's `A@{ shape: cyl }`, and only
    // knowing the name belongs to a link tells them apart. Read in source order, a node called `e1` gets invented.
    for (const line of lines) {
      for (const [, id] of maskQuotes(line).matchAll(EDGE_ID_RE)) this.edgeIds.add(id);
    }
    this.parseHeader(header);
    for (const line of lines.slice(1)) this.parseLine(line);
    dressLinks(this.graph, this.linkClasses, this.edgeIndexById);
    dropMarkers(this.graph);
    dressSubgraphs(this.graph, this.linkClasses);
    resolveClusterEdges(this.graph, this.shapedNodeIds);
    collapseGroups(this.graph);
    return this.graph;
  }

  private preprocess(text: string): string[] {
    const raw: string[] = [];
    // A `@{` block runs over line ends in mermaid's `shapeData` state, so its lines are one statement.
    for (const line of joinedBlocks(text.split(NEWLINE).map(uncommented))) raw.push(...statementsOf(line));
    const [header, ...body] = raw.map((line) => line.trim()).filter((line) => line !== "");
    return header === undefined ? [] : [header, ...withoutAccessible(body)];
  }

  private parseHeader(line: string): void {
    const parts = words(line);
    const keyword = (parts[0] ?? "").toLowerCase();
    if (!HEADER_KEYWORDS.includes(keyword)) return;
    const declared = LEGACY_DIRECTIONS.get(parts[1] ?? "") ?? directionOf(parts[1] ?? "");
    this.graph.directionDeclared = declared !== undefined;
    this.graph.direction = declared ?? Direction.TB;
  }

  private parseLine(line: string): void {
    const lower = line.toLowerCase().trim();
    if (lower.startsWith("subgraph")) return openSubgraph(this.graph, this.subgraphStack, line);
    if (lower === "end") return this.closeSubgraph();
    const heading = DIRECTION_ANYWHERE_RE.exec(line) ?? undefined;
    if (heading !== undefined) return readDirectionOverride(this.subgraphStack, heading[1]);
    if (lower.startsWith("classdef ")) return readClassDef(this.graph, line);
    if (lower.startsWith("class ")) return readClassAssignment(this.graph, line, this.linkClasses);
    if (lower.startsWith("linkstyle ")) return readLinkStyle(this.graph, line);
    if (lower.startsWith("style ")) return readStyle(this.graph, line);
    if (lower.startsWith("click ")) return readClick(this.graph, line);
    this.parseStatement(line);
  }

  private closeSubgraph(): void {
    this.subgraphStack.pop();
  }

  private parseStatement(line: string): void {
    const segments = splitByArrows(line);

    if (segments.length === 1) {
      this.declareNodes(segments[0].text);
      return;
    }

    let prevNodes: string[] = [];
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (seg.isArrow) continue;

      const currentNodes = this.declareNodes(seg.text);

      if (prevNodes.length > 0 && i > 0) {
        const arrow = segments[i - 1];
        for (const source of prevNodes) {
          for (const target of currentNodes) {
            this.graph.addEdge(
              makeEdge(source, target, {
                label: lineLabel(arrow.label),
                style: arrow.edgeStyle,
                hasArrowStart: arrow.hasArrowStart,
                hasArrowEnd: arrow.hasArrowEnd,
                arrowTypeStart: arrow.arrowTypeStart,
                arrowTypeEnd: arrow.arrowTypeEnd,
                minLength: arrow.minLength,
              })
            );
            if (arrow.edgeId !== "" && !this.edgeIndexById.has(arrow.edgeId)) {
              this.edgeIndexById.set(arrow.edgeId, this.graph.edges.length - 1);
            }
          }
        }
      }
      prevNodes = currentNodes;
    }
  }

  private declareNodes(text: string): string[] {
    const ids: string[] = [];
    for (const raw of splitAmpersand(text)) {
      const declared = this.parseNode(raw.trim());
      if (declared === undefined) continue;
      this.graph.addNode(declared.node, declared.shaped);
      registerInSubgraph(this.graph, this.subgraphStack, declared.node.id);
      ids.push(declared.node.id);
    }
    return ids;
  }

  private parseNode(raw: string): { node: Node; shaped: boolean } | undefined {
    const reading = readNode(raw, this.edgeIds, (id) => this.graph.findSubgraphById(id));
    if (reading.read === "box") {
      if (reading.collapsed) reading.box.collapsed = true;
      return undefined;
    }
    if (reading.read === "none") return undefined;
    if (reading.shaped) this.shapedNodeIds.add(reading.node.id);
    return { node: reading.node, shaped: reading.shaped };
  }
}

export function parseFlowchart(text: string): Graph {
  return new FlowchartParser(text).parse();
}

export function declaresFlowchart(text: string): boolean {
  for (const raw of text.split(NEWLINE)) {
    const line = uncommented(raw).trim();
    if (line === "") continue;
    return HEADER_KEYWORDS.includes((words(line)[0] ?? "").toLowerCase());
  }
  return false;
}
