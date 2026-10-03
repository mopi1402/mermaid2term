import type { Canvas } from "../../canvas/canvas.js";
import { Direction, type Graph } from "../../graph/model.js";
import { DEFAULT_RENDER, type RenderOptions } from "../../options.js";
import type { Declared } from "../../source/config.js";
import { TITLE_WORD } from "../../source/lines.js";
import type { ColorSlots } from "../../paint/color-slots.js";

export interface ThemeFacts {
  readonly heavyLifeline: boolean;
  readonly actorsFilled: boolean;
  // Whether a mindmap's root stands on a ground of its own.
  readonly rootFilled: boolean;
  // Whether the `neo` look lays a gradient over every box's border, which the kind then marks.
  readonly gradient: boolean;
  // An architecture edge's width and a group frame's, as the theme resolves them.
  readonly archEdgeWidth: string | undefined;
  readonly archGroupBorderWidth: string | undefined;
  // `borderColorArray` and `bkgColorArray`, under the two themes that stamp a box with a slot of them.
  readonly colorSlots: ColorSlots | undefined;
}

export type Drawing =
  | { readonly drawn: "canvas"; readonly canvas: Canvas }
  | {
      readonly drawn: "graph";
      readonly graph: Graph;
      readonly options: Partial<RenderOptions>;
      readonly foldBudget: number | undefined;
    };

// A margin is room to lay out in, never page: every drawing starts on the first row and the first column.
export const onCanvas = (canvas: Canvas): Drawing => {
  canvas.alignTopLeft();
  return { drawn: "canvas", canvas };
};
export const onGraph = (graph: Graph, options: Partial<RenderOptions>, foldBudget?: number): Drawing => ({
  drawn: "graph",
  graph,
  options,
  foldBudget,
});

interface Orientation {
  readonly start: Direction | undefined;
  readonly turns: boolean;
}

export const STILL: Orientation = { start: undefined, turns: false };

export type Render = (
  text: string,
  options: Partial<RenderOptions>,
  budget: number | undefined,
  direction: Direction | undefined,
  painting: ThemeFacts | undefined
) => Drawing;

export interface DiagramKind {
  readonly prefix: string;
  declares(text: string): boolean;
  render: Render;
  orientation(text: string, options: Partial<RenderOptions>): Orientation;
  // Whether this kind's grammar has a `title` statement of its own. mermaid hands a frontmatter title to the db
  // BEFORE the parse (`Diagram.fromText`, 11.17.0), so the statement overwrites it and one title is ever drawn.
  readonly titled: boolean;
  // The statement a frontmatter title is handed to such a kind as, written so its grammar reads the whole text.
  titleStatement(title: string): string;
  // The name this kind answers to under `config:`, which is mermaid's and not always the header word: a
  // `sequenceDiagram` reads `config.sequence`, an `erDiagram` reads `config.er`.
  readonly section: string;
  // Whether this kind tightens its own gaps and paddings to a budget, the width fit then leaving them as asked.
  readonly fitsItself: boolean;
  // Whether this kind reads `bands` and `wrapLabels`: one that reads neither is never folded nor wrapped by the fit.
  readonly folds: boolean;
}

export interface GraphKind {
  readonly prefix: string;
  // The `config.<section>` block mermaid reads for this kind.
  readonly section: string;
  declares(text: string): boolean;
  parse(text: string, options?: Partial<RenderOptions>): Graph;
  orientation(text: string, options: Partial<RenderOptions>): Orientation;
  readonly options?: Partial<RenderOptions>;
  // mermaid's own `defaultConfig` for the section, laid under what the source writes there.
  readonly defaults?: Declared;
}

// mermaid 12 wraps a flowchart's and a state's text at 120px unless the diagram says otherwise (#8211).
export const MERMAID_WRAPPING: Declared = { wrappingWidth: "120" };

export function overlaid(base: Partial<RenderOptions> | undefined, top: Partial<RenderOptions>): Partial<RenderOptions> {
  const merged: Partial<RenderOptions> = { ...base };
  for (const [key, value] of Object.entries(top)) if (value !== undefined) Object.assign(merged, { [key]: value });
  return merged;
}

const openingWith = (prefix: string) => (text: string): boolean => text.startsWith(prefix);

export function kind(
  prefix: string,
  render: Render,
  rest: Partial<Pick<DiagramKind, "declares" | "orientation" | "titled" | "titleStatement" | "section" | "fitsItself" | "folds">> = {}
): DiagramKind {
  return {
    prefix,
    declares: rest.declares ?? openingWith(prefix),
    render,
    orientation: rest.orientation ?? (() => STILL),
    titled: rest.titled ?? false,
    titleStatement: rest.titleStatement ?? ((title) => `${TITLE_WORD} ${title}`),
    section: rest.section ?? prefix,
    fitsItself: rest.fitsItself ?? false,
    folds: rest.folds ?? true,
  };
}

// The `config.<kind>` block handed to a kind, empty where the source wrote none.
export const declaredIn = (options: Partial<RenderOptions>): Declared => options.config ?? DEFAULT_RENDER.config;

// THE deviation from mermaid: a header naming no direction starts LR where mermaid starts TB. A terminal gives
// width freely and height never, so the drawing runs across and turns down only when the budget forces it.
export const engineOrientation = (graph: Graph, options: Partial<RenderOptions>): Orientation =>
  graph.directionDeclared ? STILL : { start: Direction.LR, turns: options.autoRotate ?? DEFAULT_RENDER.autoRotate };

// The border mode as a kind's own renderer reads it: a box drawn outside the engine still has to know its outline
// rides the cell edges.
export const padlessIn = (options: Partial<RenderOptions>): boolean =>
  (options.borders ?? DEFAULT_RENDER.borders) === "padless";

export const borderlessIn = (options: Partial<RenderOptions>): boolean =>
  (options.borders ?? DEFAULT_RENDER.borders) === "borderless";

export const overridden = (value: number | undefined, base: number): number | undefined =>
  value === undefined || value === base ? undefined : value;
