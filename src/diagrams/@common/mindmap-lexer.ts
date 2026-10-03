import { type ShapeElement } from "../../canvas/keys.js";
import { QUOTE, outsideQuotesAndBrackets, unfenced } from "../../source/quotes.js";
import { NEWLINE } from "../../text/chars.js";
import { indentOf } from "../../text/format.js";

// The node lexer kanban's grammar copies from mindmap's: an id, an opener, a label and its closer.

// mermaid's `NODE_DSTART` tokens in its lexer's order, each with the element `getType` gives it; a `(` closed by
// anything but `)` is a cloud.
const OPENERS: ReadonlyArray<readonly [string, ShapeElement]> = [
  ["-)", "path"],
  ["(-", "path"],
  ["))", "path"],
  [")", "path"],
  ["((", "circle"],
  ["{{", "polygon"],
  ["(", "rect"],
  ["[", "rect"],
];
const CLOSERS = ["))", ")", "]", "}}", "(-", "-)", "((", "("];
const ROUND = "(";
// mermaid's `NODE` state ends a label at the first of these.
const LABEL_STOPS = ")](}";

const FENCE_OPEN = '"`';

// Where mermaid's `NODE` state stops a label, a stop inside quotes kept as text.
function labelStop(text: string): number {
  for (const at of outsideQuotesAndBrackets(text, false)) if (LABEL_STOPS.includes(text[at])) return at;
  return -1;
}

export interface Lexed {
  readonly id: string;
  readonly element: ShapeElement;
  // The label as written, quotes or fence included, and where it starts in the statement.
  readonly written: string;
  readonly at: number;
  // What follows the closer.
  readonly rest: string;
}

export interface NodeLexer {
  // mermaid's `NODE_ID`: anything up to a bracket.
  readonly idOf: (written: string) => string;
  // Whether the text starts with one of mermaid's shape openers.
  readonly shapes: (text: string) => boolean;
  // The node as mermaid's lexer tokens it: an id unless an opener leads, one opener, a label, the first closer.
  readonly tokens: (written: string, ends?: (rest: string) => boolean) => Lexed | undefined;
  // A shape mermaid throws on, its text and element kept whole.
  readonly wrapped: (written: string) => readonly [string, ShapeElement] | undefined;
  // A string inside a shape runs over line ends in mermaid's lexer, so its lines are one node's text.
  readonly opensString: (text: string) => boolean;
  // `--show-ids`: a node written with an id of its own reads `id: label`, inside its quotes or fence when it has them.
  readonly withIds: (text: string) => string;
}

const quotes = (text: string): number => [...text].filter((ch) => ch === QUOTE).length;

// `idStops` are the characters a grammar adds to the brackets that end an id; `ends` says what may follow a closer.
export function nodeLexer(keyword: string, idStops: string, ends: (rest: string) => boolean): NodeLexer {
  const id = `[^()[\\]{}\\n${idStops}]*`;
  const idRe = new RegExp(`^${id}`, "u");
  // Each fallback keeps a shape mermaid throws on drawn whole, ordered as its lexer tries its openers.
  const fallbacks: ReadonlyArray<readonly [RegExp, ShapeElement]> = [
    [new RegExp(`^${id}\\(\\(([\\s\\S]+)\\)\\)$`, "u"), "circle"],
    [new RegExp(`^${id}\\)\\)([\\s\\S]+)\\(\\($`, "u"), "path"],
    [new RegExp(`^${id}\\[([\\s\\S]+)\\]$`, "u"), "rect"],
    [new RegExp(`^${id}\\{\\{([\\s\\S]+)\\}\\}$`, "u"), "polygon"],
    [new RegExp(`^${id}\\(([\\s\\S]+)\\)$`, "u"), "rect"],
    [new RegExp(`^${id}\\)([\\s\\S]+)\\($`, "u"), "path"],
  ];
  const openString = new RegExp(`^${id}(?:-\\)|\\(-|\\(\\(|\\)\\)|\\{\\{|[[()])"`, "u");

  const idOf = (written: string): string => idRe.exec(written)?.[0] ?? "";
  const shapes = (text: string): boolean => OPENERS.some(([open]) => text.startsWith(open));

  function tokens(written: string, closes: (rest: string) => boolean = ends): Lexed | undefined {
    const name = shapes(written) ? "" : idOf(written);
    const after = written.slice(name.length);
    const opener = OPENERS.find(([open]) => after.startsWith(open));
    if (opener === undefined) return undefined;
    const inside = after.slice(opener[0].length);
    const stop = labelStop(inside);
    if (stop <= 0) return undefined;
    const closer = CLOSERS.find((close) => inside.startsWith(close, stop));
    if (closer === undefined) return undefined;
    const rest = inside.slice(stop + closer.length);
    if (!closes(rest)) return undefined;
    const element = opener[0] === ROUND && closer !== ")" ? "path" : opener[1];
    return { id: name, element, written: inside.slice(0, stop), at: name.length + opener[0].length, rest };
  }

  function wrapped(written: string): readonly [string, ShapeElement] | undefined {
    for (const [shape, element] of fallbacks) {
      const inside = shape.exec(written) ?? undefined;
      if (inside !== undefined) return [unfenced(inside[1]), element];
    }
    return undefined;
  }

  const opensString = (text: string): boolean => openString.test(text) && quotes(text) % 2 === 1;

  function withIds(text: string): string {
    const lines = text.split(NEWLINE);
    const header = lines.findIndex((line) => line.trimStart().startsWith(keyword));
    return lines
      .map((line, row) => {
        const indent = indentOf(line);
        const token = row > header && header !== -1 ? tokens(line.trim()) : undefined;
        const name = token?.id.trim() ?? "";
        if (token === undefined || name === "" || unfenced(token.written) === name) return line;
        const open = token.written.startsWith(FENCE_OPEN) ? FENCE_OPEN.length : token.written.startsWith(QUOTE) ? QUOTE.length : 0;
        const cut = indent + token.at + open;
        return `${line.slice(0, cut)}${name}: ${line.slice(cut)}`;
      })
      .join(NEWLINE);
  }

  return { idOf, shapes, tokens, wrapped, opensString, withIds };
}
