import { NodeShape } from "./shapes.js";
import { isFenced, richSegments, type LabelSegment } from "../source/markdown.js";
import { SPACE } from "../text/chars.js";
import { oneOf } from "../must.js";
import { CLASS_DEFAULT } from "../source/css.js";

export enum ArrowType {
  ARROW = "ARROW",
  CIRCLE = "CIRCLE",
  CROSS = "CROSS",
}

export enum EdgeStyle {
  SOLID = "SOLID",
  DOTTED = "DOTTED",
  THICK = "THICK",
  INVISIBLE = "INVISIBLE",
}

export enum Direction {
  TB = "TB",
  TD = "TD",
  LR = "LR",
  BT = "BT",
  RL = "RL",
}

// A direction word in any case; `foldTd` for a kind whose db reads `TD` as `TB`.
export function directionOf(written: string, foldTd = false): Direction | undefined {
  const upper = written.toUpperCase();
  return oneOf(Object.values(Direction), foldTd && upper === Direction.TD ? Direction.TB : upper);
}

export const isVertical = (d: Direction): boolean =>
  d === Direction.TB || d === Direction.TD || d === Direction.BT;

export const isHorizontal = (d: Direction): boolean => d === Direction.LR || d === Direction.RL;

export const isReversed = (d: Direction): boolean => d === Direction.BT || d === Direction.RL;

export function normalized(d: Direction): Direction {
  if (d === Direction.BT) return Direction.TB;
  if (d === Direction.RL) return Direction.LR;
  if (d === Direction.TD) return Direction.TB;
  return d;
}

export interface Node {
  id: string;
  label: string;
  shape: NodeShape;
  styleClasses: string[];
  labelSegments: LabelSegment[] | undefined;
  // mermaid's `labelType: "markdown"`, the label `markdownAutoWrap` speaks for.
  markdown: boolean;
  link: string | undefined;
}

export function makeNode(id: string, label: string, fields: Partial<Node> = {}): Node {
  return { id, label, shape: NodeShape.RECTANGLE, styleClasses: [], labelSegments: undefined, markdown: false, link: undefined, ...fields };
}

// A node whose label mermaid marks `labelType: "markdown"`: the segments are read once, here, so no kind
// repeats the reading. The flowchart is NOT one of these, its vertex taking its type from the lexer, so only
// a `"\`...\`"` label is markdown there and a bare `**x**` is the text it is written as.
export function labelledNode(id: string, text: string, fields: Partial<Node> = {}): Node {
  const rich = richSegments(text);
  // mermaid 12 keeps a fenced state label wrapped under `markdownAutoWrap: false`, every other one on a line.
  return makeNode(id, rich?.plain ?? text, { ...fields, labelSegments: rich?.segments, markdown: !isFenced(text) });
}

export function wearClass(node: Node, name: string): void {
  if (!node.styleClasses.includes(name)) node.styleClasses.push(name);
}

const CLASS_JOIN = SPACE;

export function blendProps(classDefs: ReadonlyMap<string, ReadonlyMap<string, string>>, names: readonly string[]): Map<string, string> {
  const blend = new Map<string, string>();
  for (const name of names) for (const [prop, value] of classDefs.get(name) ?? []) blend.set(prop, value);
  return blend;
}

// Every class worn applies, the later winning a property like CSS: the blend is set as a classDef of its own, keyed
// by the joined names, so the theme keys it like any other classDef.
export function wornClass(graph: Graph, styleClasses: readonly string[]): string | undefined {
  const worn = styleClasses.filter((name) => graph.classDefs.has(name));
  if (worn.length <= 1) return worn[0];
  const joined = worn.join(CLASS_JOIN);
  if (!graph.classDefs.has(joined)) graph.classDefs.set(joined, blendProps(graph.classDefs, worn));
  return joined;
}

// What its classes alone say: the only CSS mermaid lets reach a node's words.
export function nodeClassProps(graph: Graph, styleClasses: readonly string[]): ReadonlyMap<string, string> | undefined {
  const worn = wornClass(graph, styleClasses);
  return (worn !== undefined ? graph.classDefs.get(worn) : undefined) ?? graph.classDefs.get(CLASS_DEFAULT);
}

// A node's CSS: its own `style` laid over its classes property by property, as mermaid compiles both.
export function nodeProps(graph: Graph, id: string, styleClasses: readonly string[]): ReadonlyMap<string, string> | undefined {
  const classed = nodeClassProps(graph, styleClasses);
  const own = graph.nodeStyles.get(id);
  return own === undefined ? classed : new Map([...(classed ?? []), ...own]);
}

export interface Edge {
  source: string;
  target: string;
  label: string;
  style: EdgeStyle;
  hasArrowStart: boolean;
  hasArrowEnd: boolean;
  arrowTypeStart: ArrowType;
  arrowTypeEnd: ArrowType;
  minLength: number;
  sourceIsSubgraph: boolean;
  targetIsSubgraph: boolean;
}

export function makeEdge(source: string, target: string, fields: Partial<Edge> = {}): Edge {
  return {
    source,
    target,
    label: "",
    style: EdgeStyle.SOLID,
    hasArrowStart: false,
    hasArrowEnd: true,
    arrowTypeStart: ArrowType.ARROW,
    arrowTypeEnd: ArrowType.ARROW,
    minLength: 1,
    sourceIsSubgraph: false,
    targetIsSubgraph: false,
    ...fields,
  };
}

export const isSelfReference = (e: Edge): boolean => e.source === e.target;

export interface Subgraph {
  id: string;
  label: string;
  nodeIds: string[];
  children: Subgraph[];
  direction: Direction | undefined;
  parent: Subgraph | undefined;
  collapsed: boolean;
  composite: boolean;
  concurrent: boolean;
  // Whether its title stands at the frame's left, as mermaid seats an architecture group's, where a cluster's is centred.
  titleLeft: boolean;
  // What its `class` and `style` lines dress it in, merged the way mermaid compiles a cluster's styles: its classes
  // in order, then its own `style` over them. `classDef default` is a vertex's alone and never reaches it.
  props: ReadonlyMap<string, string> | undefined;
  // mermaid's `colorIndex`: the slot of `borderColorArray` a colour theme dresses it in, where its kind hands one out.
  colorIndex: number | undefined;
}

export function makeSubgraph(id: string, label: string, fields: Partial<Subgraph> = {}): Subgraph {
  return { id, label, nodeIds: [], children: [], direction: undefined, parent: undefined, collapsed: false, concurrent: false, composite: false, titleLeft: false, props: undefined, colorIndex: undefined, ...fields };
}

export function rootsAmong(nodes: Iterable<string>, edges: readonly Edge[]): string[] {
  const targets = new Set<string>();
  for (const e of edges) if (!isSelfReference(e)) targets.add(e.target);
  return [...nodes].filter((id) => !targets.has(id));
}

export function sinksAmong(nodes: Iterable<string>, edges: readonly Edge[]): string[] {
  const sources = new Set<string>();
  for (const e of edges) if (!isSelfReference(e)) sources.add(e.source);
  return [...nodes].filter((id) => !sources.has(id));
}

export class Graph {
  direction: Direction = Direction.TB;
  directionDeclared = false;
  nodes = new Map<string, Node>();
  edges: Edge[] = [];
  subgraphs: Subgraph[] = [];
  nodeOrder: string[] = [];
  classDefs = new Map<string, Map<string, string>>();
  nodeStyles = new Map<string, Map<string, string>>();
  linkStyles = new Map<number, Map<string, string>>();
  warnings: string[] = [];
  gridPositions: Map<string, [number, number]> | undefined = undefined;

  // `shaped` says the statement SPELLED a shape, brackets or `@{ shape: }`. mermaid keeps the last one spelled,
  // an explicit `A[square]` after `A(round)` included, while a bare `A` in an edge leaves the shape alone.
  addNode(node: Node, shaped = false): void {
    const existing = this.nodes.get(node.id);
    if (existing === undefined) {
      this.nodes.set(node.id, node);
      this.nodeOrder.push(node.id);
      return;
    }
    if (node.label !== node.id) existing.label = node.label;
    if (shaped || node.shape !== NodeShape.RECTANGLE) existing.shape = node.shape;
    for (const name of node.styleClasses) wearClass(existing, name);
  }

  addEdge(edge: Edge): void {
    this.edges.push(edge);
  }

  getRoots(): string[] {
    const roots = rootsAmong(this.nodeOrder, this.edges);
    if (roots.length > 0) return roots;
    const first = this.nodeOrder[0];
    return first === undefined ? [] : [first];
  }

  getChildren(nodeId: string): string[] {
    const seen = new Set<string>();
    const children: string[] = [];
    for (const e of this.edges) {
      if (e.source === nodeId && e.target !== nodeId && !seen.has(e.target)) {
        seen.add(e.target);
        children.push(e.target);
      }
    }
    return children;
  }

  findSubgraphById(id: string): Subgraph | undefined {
    const search = (subs: Subgraph[]): Subgraph | undefined => {
      for (const sg of subs) {
        if (sg.id === id) return sg;
        const found = search(sg.children);
        if (found !== undefined) return found;
      }
      return undefined;
    };
    return search(this.subgraphs);
  }

  findSubgraphForNode(nodeId: string): Subgraph | undefined {
    const search = (subs: Subgraph[]): Subgraph | undefined => {
      for (const sg of subs) {
        const found = search(sg.children);
        if (found !== undefined) return found;
        if (sg.nodeIds.includes(nodeId)) return sg;
      }
      return undefined;
    };
    return search(this.subgraphs);
  }
}
