import { type ShapeElement } from "../../canvas/keys.js";
import { cellsFor } from "../../text/wrap.js";

// mermaid 12's own `maxNodeWidth` when the diagram states none.
const MERMAID_NODE_WIDTH_PX = 200;

export interface MindmapNode {
  label: string;
  children: MindmapNode[];
  element: ShapeElement;
  icon?: string;
  classes?: string;
}

export interface Mindmap {
  root: MindmapNode | undefined;
  // `maxNodeWidth` read in columns: the width a label wraps at.
  wrap: number;
}

export const makeMindmap = (): Mindmap => ({ root: undefined, wrap: cellsFor(MERMAID_NODE_WIDTH_PX) });
// A node written with no shape is mermaid's default one, drawn as a `path`.
export const makeMindmapNode = (label: string, children: MindmapNode[] = [], element: ShapeElement = "path"): MindmapNode => ({
  label,
  children,
  element,
});
