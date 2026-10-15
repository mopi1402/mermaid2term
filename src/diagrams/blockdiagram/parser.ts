import {
  AUTO_COLUMNS,
  makeBlock,
  makeBlockDiagram,
  type Block,
  type BlockDiagram,
  type BlockLink,
} from "./model.js";
import { BR_RE, LITERAL_NEWLINE, lineLabel } from "../../text/labels.js";
import { htmlDecoded } from "../../text/entities.js";
import { taggedSegments } from "../../source/markdown.js";
import { WORD_CHAR, WORD_CHARS } from "../../text/format.js";
import { NodeShape, SHAPE_DELIMITERS, openingOf } from "../../graph/shapes.js";
import { contentLines, headerBody, headerTail } from "../../source/lines.js";
import { QUOTE, insideQuotes, stripQuotes } from "../../source/quotes.js";
import { CLASS_RE, STYLE_RE, cssLineOf, readClassDef } from "../../source/css.js";
import { classifyBlockLink } from "./links.js";
import { withoutAccessible } from "../@common/accessible.js";
import type { Toward } from "../../canvas/corners.js";

const W = WORD_CHAR;

const HEADER_RE = /^block(?:-beta)?(?=\s|$)/iu;
const COLUMNS_KEY_RE = /^columns$/iu;
const COLUMNS_COUNT_RE = /^\d+$/u;
const COLUMNS_AUTO_RE = /^auto$/iu;
const NAMED_GROUP_RE = /^block:(.+)$/iu;
const SPACE_RE = /^space(?::(\d+))?$/iu;
const BLOCK_ARROW_RE = new RegExp(String.raw`^(${W}+)<\["([^"]*)"\]>\(([^)]+)\)(?::(\d+))?$`, "u");
const SPAN_SUFFIX_RE = /:(\d+)$/u;
const BARE_ID_RE = new RegExp(String.raw`^${W}[${WORD_CHARS}.-]*$`, "u");
// mermaid's LINK and START_LINK lexemes; its `NODE_ID` takes a leading `x` or `o` first, so neither opens a link.
const LINK_RE = /<?(?:--+[-xo>]|==+[=xo>]|-?\.+-[xo>]?)/uy;
const START_LINK_RE = /<?(?:--|==|-\.)(?=\s*")/uy;
const DIRECTION_SPLIT_RE = /[\s,]+/u;

const END = "end";
const GROUP = "block";
const OPENERS = "([{";
const CLOSERS = ")]}";
const ARROW_OPEN = "<";
const ARROW_CLOSE = ">";
const DEFAULT_SPAN = 1;

// mermaid lays a block of width 0 at Infinity, all its diagram with it; here it takes one column.
const blockSpan = (written: string | undefined): number =>
  written === undefined ? DEFAULT_SPAN : Math.max(DEFAULT_SPAN, Number.parseInt(written, 10));

const DIRECTIONS: ReadonlyMap<string, readonly Toward[]> = new Map([
  ["right", ["right"]],
  ["left", ["left"]],
  ["up", ["up"]],
  ["down", ["down"]],
  ["x", ["left", "right"]],
  ["y", ["up", "down"]],
]);

// mermaid's block lexer reads `(-` `-)` too, then `typeStr2Type` names no shape for them and the box falls back to
// a rectangle.
const BLOCK_DELIMITERS: typeof SHAPE_DELIMITERS = [["(-", "-)", NodeShape.RECTANGLE], ...SHAPE_DELIMITERS];

type Item = { kind: "word" | "link" | "open"; text: string };

// A block as written: `typed` when its shape was, which is what lets a later statement retype it in mermaid.
interface Written {
  block: Block;
  typed: boolean;
}

export function parseBlockDiagram(text: string): BlockDiagram {
  return new BlockParser(preprocess(text)).parse();
}

// A first line that is no header is a statement of its own.
function preprocess(text: string): string[] {
  const lines = withoutAccessible(contentLines(text));
  return lines.length > 0 && headerTail(lines[0], HEADER_RE) === undefined ? lines : headerBody(lines, HEADER_RE);
}

class BlockParser {
  private anonCount = 0;
  private spaceCount = 0;
  private readonly styled = makeBlockDiagram();
  private readonly known = new Map<string, Block>();
  private readonly links: BlockLink[] = [];
  private readonly items: Item[] = [];
  private at = 0;

  constructor(lines: string[]) {
    for (const line of lines) if (!this.styling(line)) this.items.push(...lex(line));
  }

  parse(): BlockDiagram {
    const { blocks, columns } = this.group();
    const { classDefs, classes, styles } = this.styled;
    return makeBlockDiagram({ blocks, links: this.links, columns, classDefs, classes, styles });
  }

  // `classDef`, `class a,b c1` and `style a …`; mermaid throws on `style a,b`, which is skipped here.
  private styling(line: string): boolean {
    if (readClassDef(this.styled.classDefs, line)) return true;
    const worn = CLASS_RE.exec(line) ?? undefined;
    if (worn !== undefined) {
      for (const id of worn[1].split(",")) this.styled.classes.set(id.trim(), [...(this.styled.classes.get(id.trim()) ?? []), ...worn[2].split(",")]);
      return true;
    }
    const style = cssLineOf(line, STYLE_RE);
    if (style === undefined) return false;
    if (!style.names.includes(",")) this.styled.styles.set(style.names, style.props);
    return true;
  }

  private next(kind: Item["kind"]): string | undefined {
    const item = this.items[this.at] ?? undefined;
    if (item === undefined || item.kind !== kind) return undefined;
    this.at += 1;
    return item.text;
  }

  private group(): { blocks: Block[]; columns: number } {
    const blocks: Block[] = [];
    let columns = AUTO_COLUMNS;

    while (this.at < this.items.length) {
      const item = this.items[this.at];
      this.at += 1;
      // A link with no block before it, as a chain's second link: mermaid throws on it.
      if (item.kind !== "word") continue;
      const word = item.text;
      const lower = word.toLowerCase();

      if (lower === END) break;

      if (COLUMNS_KEY_RE.test(word)) {
        const setting = this.items[this.at] ?? undefined;
        if (setting?.kind === "word" && (COLUMNS_COUNT_RE.test(setting.text) || COLUMNS_AUTO_RE.test(setting.text))) {
          columns = COLUMNS_AUTO_RE.test(setting.text) ? AUTO_COLUMNS : Number.parseInt(setting.text, 10);
          this.at += 1;
          continue;
        }
      }

      if (lower === GROUP) {
        this.anonCount += 1;
        blocks.push(this.composite(makeBlock(`_anon_group_${this.anonCount}`)));
        continue;
      }

      const named = NAMED_GROUP_RE.exec(word) ?? undefined;
      const opener = named === undefined ? undefined : this.written(named[1]);
      if (opener !== undefined) {
        const { id, colSpan } = opener.block;
        // mermaid titles a composite with its written label alone, never its id.
        const label = opener.typed ? opener.block.label : "";
        // Named before, mermaid keeps its first cell and relabels it, and the children it is given now are lost.
        const existing = this.known.get(id);
        if (existing !== undefined) existing.label = label;
        const group = this.composite(makeBlock(id, { label, colSpan }));
        if (existing === undefined) blocks.push(group);
        else this.known.set(id, existing);
        continue;
      }

      blocks.push(...this.statement(word));
    }

    return { blocks, columns };
  }

  // mermaid overwrites a composite's type, so its brackets say nothing and only their label titles the frame.
  private composite(group: Block): Block {
    this.known.set(group.id, group);
    const nested = this.group();
    group.children = nested.blocks;
    group.columns = nested.columns;
    return group;
  }

  // A block, or a link between two, as the blocks it adds to this level.
  private statement(word: string): Block[] {
    const source = this.declare(word);
    if (source === undefined) return [];
    const added = source.fresh ? [source.block] : [];
    const link = this.link();
    const target = link === undefined ? undefined : this.next("word");
    const reached = target === undefined ? undefined : this.declare(target);
    if (reached?.fresh === true) added.push(reached.block);
    if (link === undefined || reached === undefined || source.block.isSpace || reached.block.isSpace) return added;
    const { style, hasStart, hasEnd, typeStart, typeEnd } = classifyBlockLink(link.text);
    this.links.push({
      source: source.block.id,
      target: reached.block.id,
      label: link.label,
      style,
      hasArrowStart: hasStart,
      hasArrowEnd: hasEnd,
      typeStart,
      typeEnd,
    });
    return added;
  }

  // `-->`, or `-- "t" -->`, whose closing link alone gives the heads and the line, as mermaid's `edgeTypeStr`.
  private link(): { text: string; label: string } | undefined {
    const plain = this.next("link");
    if (plain !== undefined) return { text: plain, label: "" };
    if (this.next("open") === undefined) return undefined;
    const resume = this.at;
    const label = this.next("word");
    const closing = label?.startsWith(QUOTE) === true ? this.next("link") : undefined;
    if (label !== undefined && closing !== undefined) return { text: closing, label: lineLabel(stripQuotes(label)) };
    this.at = resume;
    return undefined;
  }

  // mermaid keeps a block's first cell: a later statement only retypes it, when it writes a shape, and relabels it.
  private declare(word: string): { block: Block; fresh: boolean } | undefined {
    const written = this.written(word);
    if (written === undefined) return undefined;
    const { block, typed } = written;
    if (block.isSpace) return { block, fresh: true };
    const existing = this.known.get(block.id);
    if (existing === undefined) {
      this.known.set(block.id, block);
      return { block, fresh: true };
    }
    if (typed) {
      existing.shape = block.shape;
      if (existing.arrows.length === 0) existing.arrows = block.arrows;
    }
    if (block.label !== block.id) existing.label = block.label;
    return { block: existing, fresh: false };
  }

  private written(token: string): Written | undefined {
    if (token === "") return undefined;
    token = token.replace(BR_RE, LITERAL_NEWLINE);

    const space = SPACE_RE.exec(token) ?? undefined;
    if (space !== undefined) {
      this.spaceCount += 1;
      const colSpan = space[1] === undefined ? DEFAULT_SPAN : Number.parseInt(space[1], 10);
      return { block: makeBlock(`_space_${this.spaceCount}`, { isSpace: true, colSpan }), typed: true };
    }

    const arrow = BLOCK_ARROW_RE.exec(token) ?? undefined;
    if (arrow !== undefined) {
      const label = htmlDecoded(arrow[2]);
      const colSpan = blockSpan(arrow[4]);
      if (label.trim() === "") return { block: makeBlock(arrow[1], { isSpace: true, colSpan }), typed: true };
      return { block: makeBlock(arrow[1], { ...taggedLabel(label), colSpan, arrows: directionsOf(arrow[3]) }), typed: true };
    }

    const span = SPAN_SUFFIX_RE.exec(token) ?? undefined;
    const colSpan = blockSpan(span?.[1]);
    if (span !== undefined) token = token.slice(0, span.index);

    const opening = openingOf(token, insideQuotes, BLOCK_DELIMITERS);
    if (opening !== undefined) {
      return { block: makeBlock(opening.id, { ...taggedLabel(htmlDecoded(stripQuotes(opening.label))), shape: opening.shape, colSpan }), typed: true };
    }

    const id = token.trim();
    if (id !== "" && BARE_ID_RE.test(id)) return { block: makeBlock(id, { label: id, colSpan }), typed: false };
    return undefined;
  }
}

function directionsOf(written: string): Toward[] {
  const tips = new Set<Toward>();
  for (const word of written.split(DIRECTION_SPLIT_RE)) for (const tip of DIRECTIONS.get(word) ?? []) tips.add(tip);
  return [...tips];
}

// Splits a line on the spaces outside quotes and brackets, and cuts every link out of it as mermaid's lexer does.
function lex(line: string): Item[] {
  const items: Item[] = [];
  let current = "";
  // What stands open, innermost last: a `>` closes the `<` of a block arrow alone, never a bracket.
  const open: string[] = [];
  let inQuote = false;

  const flush = (): void => {
    const word = current.trim();
    if (word !== "") items.push({ kind: "word", text: word });
    current = "";
  };
  const cut = (re: RegExp, at: number): string | undefined => {
    re.lastIndex = at;
    return re.exec(line)?.[0] ?? undefined;
  };

  let at = 0;
  while (at < line.length) {
    const ch = line[at];
    if (!inQuote && open.length === 0) {
      const link = cut(LINK_RE, at);
      const text = link ?? cut(START_LINK_RE, at);
      if (text !== undefined) {
        flush();
        items.push({ kind: link === undefined ? "open" : "link", text });
        at += text.length;
        continue;
      }
    }
    at += 1;
    if (ch === QUOTE) {
      inQuote = !inQuote;
      current += ch;
    } else if (inQuote) {
      current += ch;
    } else if (OPENERS.includes(ch) || ch === ARROW_OPEN) {
      open.push(ch);
      current += ch;
    } else if (CLOSERS.includes(ch)) {
      open.pop();
      current += ch;
    } else if (ch === ARROW_CLOSE && open[open.length - 1] === ARROW_OPEN) {
      open.pop();
      current += ch;
    } else if (ch === " " && open.length === 0) {
      flush();
    } else {
      current += ch;
    }
  }
  flush();
  return items;
}

// mermaid 12 renders a block's `<b>` and `<i>` and leaves its `**` as text; a label of several rows keeps one weight.
function taggedLabel(written: string): Pick<Block, "label" | "labelSegments"> {
  const tagged = taggedSegments(written);
  if (tagged === undefined) return { label: written, labelSegments: undefined };
  return { label: tagged.plain, labelSegments: tagged.plain.includes(LITERAL_NEWLINE) ? undefined : tagged.segments };
}
