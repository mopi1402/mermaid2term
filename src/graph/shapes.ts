export enum NodeShape {
  RECTANGLE = "RECTANGLE",
  ROUNDED = "ROUNDED",
  STADIUM = "STADIUM",
  SUBROUTINE = "SUBROUTINE",
  DIAMOND = "DIAMOND",
  HEXAGON = "HEXAGON",
  CIRCLE = "CIRCLE",
  DOUBLE_CIRCLE = "DOUBLE_CIRCLE",
  ASYMMETRIC = "ASYMMETRIC",
  CYLINDER = "CYLINDER",
  HORIZONTAL_CYLINDER = "HORIZONTAL_CYLINDER",
  PARALLELOGRAM = "PARALLELOGRAM",
  PARALLELOGRAM_ALT = "PARALLELOGRAM_ALT",
  TRAPEZOID = "TRAPEZOID",
  TRAPEZOID_ALT = "TRAPEZOID_ALT",
  BRACE_LEFT = "BRACE_LEFT",
  BRACE_RIGHT = "BRACE_RIGHT",
  BRACES = "BRACES",
  DIVIDED_RECTANGLE = "DIVIDED_RECTANGLE",
  LINED_RECTANGLE = "LINED_RECTANGLE",
  NOTCHED_RECTANGLE = "NOTCHED_RECTANGLE",
  SMALL_CIRCLE = "SMALL_CIRCLE",
  FRAMED_CIRCLE = "FRAMED_CIRCLE",
  HOURGLASS = "HOURGLASS",
  START_STATE = "START_STATE",
  END_STATE = "END_STATE",
  CHOICE_STATE = "CHOICE_STATE",
  NOTE = "NOTE",
  FORK_JOIN = "FORK_JOIN",
  OUTLINED_BAR = "OUTLINED_BAR",
  LOLLIPOP = "LOLLIPOP",
  JUNCTION = "JUNCTION",
  COLLAPSED_GROUP = "COLLAPSED_GROUP",
  TEXT = "TEXT",
  DOCUMENT = "DOCUMENT",
  STACKED_DOCUMENT = "STACKED_DOCUMENT",
  LINED_DOCUMENT = "LINED_DOCUMENT",
  TAGGED_DOCUMENT = "TAGGED_DOCUMENT",
  TAGGED_RECTANGLE = "TAGGED_RECTANGLE",
  STACKED_RECTANGLE = "STACKED_RECTANGLE",
  PAPER_TAPE = "PAPER_TAPE",
  WINDOW_PANE = "WINDOW_PANE",
  STORED_DATA = "STORED_DATA",
  DELAY = "DELAY",
  DISPLAY = "DISPLAY",
  SLOPED_RECTANGLE = "SLOPED_RECTANGLE",
  NOTCHED_PENTAGON = "NOTCHED_PENTAGON",
  FOLDER = "FOLDER",
  DATA_STORE = "DATA_STORE",
  CONSOLE = "CONSOLE",
  BROWSER = "BROWSER",
  PERSON = "PERSON",
  CLOUD = "CLOUD",
  BANG = "BANG",
  TRIANGLE = "TRIANGLE",
  FLIPPED_TRIANGLE = "FLIPPED_TRIANGLE",
  FILLED_CIRCLE = "FILLED_CIRCLE",
  CROSSED_CIRCLE = "CROSSED_CIRCLE",
  LIGHTNING_BOLT = "LIGHTNING_BOLT",
}

// MOST SPECIFIC FIRST: `((` has to be tried before `(`, or a circle reads as a rounded box.
export const SHAPE_DELIMITERS: ReadonlyArray<readonly [open: string, close: string, shape: NodeShape]> = [
  ["(((", ")))", NodeShape.DOUBLE_CIRCLE],
  ["((", "))", NodeShape.CIRCLE],
  ["([", "])", NodeShape.STADIUM],
  ["[(", ")]", NodeShape.CYLINDER],
  ["[[", "]]", NodeShape.SUBROUTINE],
  ["[/", "\\]", NodeShape.TRAPEZOID],
  ["[\\", "/]", NodeShape.TRAPEZOID_ALT],
  ["[/", "/]", NodeShape.PARALLELOGRAM],
  ["[\\", "\\]", NodeShape.PARALLELOGRAM_ALT],
  ["{{", "}}", NodeShape.HEXAGON],
  ["{", "}", NodeShape.DIAMOND],
  ["(", ")", NodeShape.ROUNDED],
  [">", "]", NodeShape.ASYMMETRIC],
  ["[", "]", NodeShape.RECTANGLE],
];

export interface Opening {
  readonly id: string;
  readonly label: string;
  readonly shape: NodeShape;
}

// The traits several stages read off a shape, kept here so each set is written once.

// A state diagram's lone pseudo-states: its start, its end and a choice.
export const STATE_POINTS: ReadonlySet<NodeShape> = new Set([NodeShape.START_STATE, NodeShape.END_STATE, NodeShape.CHOICE_STATE]);

// Marks one cell wide and one tall, their name never written.
export const STATE_MARKS: ReadonlySet<NodeShape> = new Set([
  NodeShape.START_STATE,
  NodeShape.END_STATE,
  NodeShape.CHOICE_STATE,
  NodeShape.FILLED_CIRCLE,
  NodeShape.CROSSED_CIRCLE,
  NodeShape.LIGHTNING_BOLT,
]);

export const MARKS: ReadonlySet<NodeShape> = new Set([
  NodeShape.SMALL_CIRCLE,
  NodeShape.FRAMED_CIRCLE,
  NodeShape.HOURGLASS,
  NodeShape.START_STATE,
  NodeShape.END_STATE,
  NodeShape.CHOICE_STATE,
  NodeShape.LOLLIPOP,
  NodeShape.JUNCTION,
  NodeShape.TRIANGLE,
  NodeShape.FLIPPED_TRIANGLE,
  NodeShape.FILLED_CIRCLE,
  NodeShape.CROSSED_CIRCLE,
  NodeShape.LIGHTNING_BOLT,
]);

export const BARS: ReadonlySet<NodeShape> = new Set([NodeShape.FORK_JOIN, NodeShape.OUTLINED_BAR]);

// A brace is one stroke per side with nothing between them.
export const BRACE_SHAPES: ReadonlySet<NodeShape> = new Set([NodeShape.BRACE_LEFT, NodeShape.BRACE_RIGHT, NodeShape.BRACES]);

// The shape a node token opens: the delimiter opening earliest, right after the id, the most specific first where two
// open on the same column. A `>` or a `(` further on sits inside the label and says nothing of the shape.
export function openingOf(
  token: string,
  quoted: (text: string, at: number) => boolean,
  delimiters: typeof SHAPE_DELIMITERS = SHAPE_DELIMITERS
): Opening | undefined {
  const tried = delimiters.map(([open, close, shape], order) => ({ open, close, shape, order, at: token.indexOf(open) }))
    .filter(({ at }) => at > 0 && !quoted(token, at))
    .sort((a, b) => a.at - b.at || a.order - b.order);
  for (const { open, close, shape, at } of tried) {
    const rest = token.slice(at + open.length);
    const id = token.slice(0, at).trim();
    if (rest.endsWith(close) && id !== "") return { id, label: rest.slice(0, -close.length).trim(), shape };
  }
  return undefined;
}
