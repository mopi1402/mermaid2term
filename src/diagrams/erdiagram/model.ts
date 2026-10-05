import type { RelationLabel } from "../../source/markdown.js";
import { Direction } from "../../graph/model.js";
import { DEFAULT_DIRECTION, type BoxDiagram, type Laid, type LineStyle } from "../@common/box-diagram.js";

export { DASHED, SOLID, type LineStyle } from "../@common/box-diagram.js";
import { Canvas } from "../../canvas/canvas.js";
import type { FrameBox } from "../../canvas/frame-style.js";

export const CARDINALITIES = ["||", "|o", "}|", "}o", "o|", "|{", "o{"] as const;

// mermaid's `u`, MD_PARENT: an end its renderer draws with no marker at all.
export const MD_PARENT = "u";

export type Cardinality = (typeof CARDINALITIES)[number] | typeof MD_PARENT;

export interface Attribute {
  type: string;
  name: string;
  keys: string[];
  comment: string;
}

export interface Entity {
  name: string;
  alias: string;
  attributes: Attribute[];
  cssClasses: string[];
  styles: Map<string, string>;
}

export const displayName = (entity: Entity): string => entity.alias || entity.name;

export interface Relationship {
  entity1: string;
  entity2: string;
  card1: Cardinality;
  card2: Cardinality;
  lineStyle: LineStyle;
  label: string;
  labelSegments: RelationLabel["labelSegments"];
}

export interface EntityGroup {
  id: string;
  title: string;
  entities: string[];
  children: EntityGroup[];
  direction: Direction | undefined;
  // mermaid's `setClass` and `addCssStyles` both look an id up among the subgraphs as well as the entities, so a
  // frame wears what a box wears.
  cssClasses: string[];
  styles: Map<string, string>;
}

export const makeGroup = (id: string, title: string): EntityGroup => ({
  id,
  title,
  entities: [],
  children: [],
  direction: undefined,
  cssClasses: [],
  styles: new Map(),
});

// A group by its id, however deep it is nested: `style grp` and `class grp` name one from anywhere in the source.
export function groupOf(groups: readonly EntityGroup[], id: string): EntityGroup | undefined {
  for (const group of groups) {
    if (group.id === id) return group;
    const found = groupOf(group.children, id);
    if (found !== undefined) return found;
  }
  return undefined;
}

export interface ERDiagram extends BoxDiagram {
  entities: Map<string, Entity>;
  relationships: Relationship[];
  groups: EntityGroup[];
}

export const makeEntity = (name: string): Entity => ({ name, alias: "", attributes: [], cssClasses: [], styles: new Map() });

export const makeERDiagram = (): ERDiagram => ({
  entities: new Map(),
  relationships: [],
  groups: [],
  classDefs: new Map(),
  direction: DEFAULT_DIRECTION,
  directionDeclared: false,
  warnings: [],
});

export interface EndOffsets {
  exit: Map<number, number>;
  arrival: Map<number, number>;
}
export interface Layout extends Laid {
  layers: string[][];
  offsets: EndOffsets;
  isLR: boolean;
  airy: boolean;
  slots: Map<string, number> | undefined;
  corridorInset: number;
  chips: Map<number, { top: boolean; at: number }> | undefined;
}

export interface PinnedEnds {
  one: PinnedEnd | undefined;
  two: PinnedEnd | undefined;
}

export interface PinnedEnd {
  spot: Spot;
  name: string;
  flank?: -1 | 1;
}

export type Spot = FrameBox;

export interface Block {
  panel: Canvas;
  title: string;
  spots: Map<string, Spot>;
  // Where each frame landed, by group id: `style grp` and `class grp` name one, and only its rectangle can wear them.
  frames: Map<string, Spot>;
}
