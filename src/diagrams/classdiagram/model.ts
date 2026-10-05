import type { RelationLabel } from "../../source/markdown.js";
import { type BoxDiagram, type Laid, type LineStyle } from "../@common/box-diagram.js";
import { Direction } from "../../graph/model.js";

export { DASHED, SOLID } from "../@common/box-diagram.js";

// A header naming no direction draws across the page: the terminal gives width freely and height never.
const DEFAULT_CLASS_DIRECTION = Direction.LR;

export const VISIBILITIES = ["+", "-", "#", "~"] as const;
type Visibility = (typeof VISIBILITIES)[number];
export const ABSTRACT = "*";
export const STATIC = "$";
export const CLASSIFIERS = [ABSTRACT, STATIC] as const;
type Classifier = (typeof CLASSIFIERS)[number];

export interface Member {
  name: string;
  visibility: Visibility | undefined;
  returnType: string;
  isMethod: boolean;
  classifier: Classifier | undefined;
}

export interface ClassDef {
  name: string;
  label: string;
  annotation: string;
  members: Member[];
  lollipop: boolean;
  link: string | undefined;
  styles: Map<string, string>;
  cssClasses: string[];
  // The columns and rows a class grows so the self relations nesting round it each keep their own cells.
  grown?: readonly [number, number];
}

export const LOLLIPOP = "()";
export const MARKERS = ["<|", "|>", "*", "o", "<", ">", LOLLIPOP] as const;
export type Marker = (typeof MARKERS)[number];

export interface Relationship {
  source: string;
  target: string;
  sourceMarker: Marker | undefined;
  targetMarker: Marker | undefined;
  lineStyle: LineStyle;
  label: string;
  labelSegments: RelationLabel["labelSegments"];
  sourceCard: string;
  targetCard: string;
}

export interface Note {
  text: string;
  target: string;
}

export interface Namespace {
  id: string;
  label: string;
  explicit: boolean;
  classes: string[];
  children: Namespace[];
}

export interface ClassDiagram extends BoxDiagram {
  classes: Map<string, ClassDef>;
  relationships: Relationship[];
  notes: Note[];
  namespaces: Namespace[];
}

export const makeClassDef = (name: string): ClassDef => ({ name, label: name, annotation: "", members: [], lollipop: false, link: undefined, styles: new Map(), cssClasses: [] });

export const makeClassDiagram = (): ClassDiagram => ({
  classes: new Map(),
  relationships: [],
  notes: [],
  namespaces: [],
  classDefs: new Map(),
  direction: DEFAULT_CLASS_DIRECTION,
  directionDeclared: false,
  warnings: [],
});

export interface Frame {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

// Several self relations on one class nest as a flowchart's loops do: each leaves the lid, rides a row further out,
// turns past the one inside it and its label, and comes back to the wall a row further from the lid.
export interface NestPlan {
  readonly loops: readonly Relationship[];
  // The loops leave the floor rather than the lid, laid upward.
  readonly floor: boolean;
  // The wall row each loop comes back on, from the box's own top.
  readonly returns: readonly number[];
  // The cells in from the corner each loop leaves the lid by.
  readonly exits: readonly number[];
}

export interface Layout extends Laid {
  frames: Frame[];
  // The rows of each class's compartment rules, from its own top: a relation never meets a side there.
  rules?: ReadonlyMap<string, readonly number[]>;
  // The wall each self relation loops out of, +1 right and -1 left.
  loops: Map<string, number>;
  // How the self relations of a class holding several nest round it.
  nests?: ReadonlyMap<string, NestPlan>;
  // The relations within one layer sent round the boxes standing between their ends.
  detours?: ReadonlyMap<Relationship, Detour>;
  // The cells past each layer's far side its detours take, which the relations leaving that side cross first.
  rideRoom?: ReadonlyMap<number, number>;
}

// A relation within one layer whose straight run would cross a box of it rides past the layer's far side instead.
export interface Detour {
  // The row it rides along, or the column down the page.
  readonly ride: number;
  // +1 past the bottom (or right) of the layer, -1 past its top (or left).
  readonly side: number;
  // The column (or row) it leaves its source by and the one it reaches its target by.
  readonly exit: number;
  readonly arrival: number;
}
