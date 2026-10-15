import { NodeShape } from "../../graph/shapes.js";
import { ArrowType, EdgeStyle } from "../../graph/model.js";
import type { Toward } from "../../canvas/corners.js";
import type { LabelSegment } from "../../source/markdown.js";

export interface Block {
  id: string;
  label: string;
  shape: NodeShape;
  colSpan: number;
  isSpace: boolean;
  children: Block[];
  columns: number;
  // A block arrow's tips, `x` and `y` already spread to their two sides.
  arrows: Toward[];
  // The weights `<b>` and `<i>` give a one-row label, the tags already off `label`.
  labelSegments: LabelSegment[] | undefined;
}

export interface BlockLink {
  source: string;
  target: string;
  label: string;
  style: EdgeStyle;
  hasArrowStart: boolean;
  hasArrowEnd: boolean;
  typeStart: ArrowType;
  typeEnd: ArrowType;
}

export interface BlockDiagram {
  blocks: Block[];
  links: BlockLink[];
  columns: number;
  // `classDef`, `class` and `style`, read by id whenever they come: mermaid applies them once every block is known.
  classDefs: Map<string, Map<string, string>>;
  classes: Map<string, string[]>;
  styles: Map<string, Map<string, string>>;
}

const DEFAULT_SHAPE = NodeShape.RECTANGLE;
export const AUTO_COLUMNS = 0;

export const makeBlock = (id: string, fields: Partial<Block> = {}): Block => ({
  id,
  label: "",
  shape: DEFAULT_SHAPE,
  colSpan: 1,
  isSpace: false,
  children: [],
  columns: AUTO_COLUMNS,
  arrows: [],
  labelSegments: undefined,
  ...fields,
});

export const makeBlockDiagram = (fields: Partial<BlockDiagram> = {}): BlockDiagram => ({
  blocks: [],
  links: [],
  columns: AUTO_COLUMNS,
  classDefs: new Map(),
  classes: new Map(),
  styles: new Map(),
  ...fields,
});
