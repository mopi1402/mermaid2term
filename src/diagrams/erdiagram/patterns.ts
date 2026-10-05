import {
  CARDINALITIES,
  DASHED,
  MD_PARENT,
  SOLID,
  type Cardinality,
  type LineStyle,
  type Attribute,
} from "./model.js";
import { WORD_CHAR, listed } from "../../text/format.js";
import { oneOf } from "../../must.js";
import { generics } from "../@common/generics.js";
import { boxLabel } from "../../text/labels.js";
import { BACKTICKED, unBackticked } from "../../source/quotes.js";
const W = WORD_CHAR;

export const SUBGRAPH_RE = new RegExp(String.raw`^\s*subgraph\s+(?:"([^"]+)"|(\S+))(?:\s*\[\s*(.+?)\s*\])?\s*$`, "iu");

export const END_RE = /^\s*end\s*$/iu;

// mermaid's `UNICODE_TEXT` is `([^\x00-\x7F]|\w|\-|\*|\.)+`, so a dotted name like `public.users` and a
// decimal like `3.5` are one id. Punctuation alone is refused, where the lexer would have taken `--` or `..` for
// the relation it spells before ever reading a name.
const BARE = String.raw`(?![-*.]+$)(?:${W}|[-*.])+`;

// The alias between brackets is an `entityName` too, so it is a quoted run or one bare name.
const ALIAS = String.raw`(?:\[("[^"]*"|(?![-*.]+\])(?:${W}|[-*.])+)\])?`;

export const ENTITY_BRACE_RE = new RegExp(String.raw`^\s*(?:"([^"]+)"|(${BARE}))${ALIAS}\s*\{\s*$`, "u");

// `CUSTOMER {}` and `CUSTOMER { string name }`: mermaid's block state skips every blank, newlines included, so a
// block opened and closed on one line is the same statement written on one row.
export const ENTITY_INLINE_BRACE_RE = new RegExp(String.raw`^\s*(?:"([^"]+)"|(${BARE}))${ALIAS}\s*\{(.*)\}\s*$`, "u");

export const ENTITY_STANDALONE_RE = new RegExp(String.raw`^\s*(?:"([^"]+)"|(${BARE}))${ALIAS}\s*$`, "u");

const namedEntity = (n: number): string => String.raw`(?:"(?<quoted${n}>[^"]+)"|(?<bare${n}>${BARE}))`;

// mermaid's `block_bq` state reads a run between backticks as one word of a row, spaces and all.
const CELL = String.raw`(${BACKTICKED}|\S+)`;

// `%options case-insensitive` opens mermaid's ER lexer, so `pk` and `Pk` are the key `PK` names, and the word
// is kept as the author wrote it: `attributeKeyType` hands the token through.
// Its block state skips every blank, so a row holds as many attributes as it has type-name pairs.
const ATTR_STEP_RE = new RegExp(
  String.raw`\s*${CELL}\s+${CELL}(?:\s+((?:PK|FK|UK)(?:\s*,\s*(?:PK|FK|UK))*))?(?:\s+"([^"]*)")?(?=\s|$)`,
  "iuy"
);
const BLANK_TAIL_RE = /^\s*$/u;

// mermaid's `STYLE_SEPARATOR idList`: a comma list of classes, and the separator may follow an alias as well
// (`entityName SQS entityName SQE STYLE_SEPARATOR idList`).
export const CSS_MARK_RE = new RegExp(String.raw`(?:"([^"]+)"|(${BARE}))${ALIAS}:::(${W}+(?:\s*,\s*${W}+)*)`, "gu");

const CARD_ALIASES: ReadonlyArray<readonly [string, Cardinality, Cardinality]> = [
  ["zero or one", "|o", "o|"],
  ["one or zero", "|o", "o|"],
  ["zero or more", "}o", "o{"],
  ["zero or many", "}o", "o{"],
  ["many(0)", "}o", "o{"],
  ["0+", "}o", "o{"],
  ["one or more", "}|", "|{"],
  ["one or many", "}|", "|{"],
  ["many(1)", "}|", "|{"],
  ["1+", "}|", "|{"],
  ["only one", "||", "||"],
  ["1", "||", "||"],
  // mermaid lexes the bare words too, `many` as zero or more and `one` as exactly one.
  ["many", "}o", "o{"],
  ["one", "||", "||"],
];

const LEFT_CARD: Readonly<Partial<Record<Cardinality, Cardinality>>> = { "o{": "}o", "|{": "}|", "o|": "|o" };

const RIGHT_CARD: Readonly<Partial<Record<Cardinality, Cardinality>>> = { "}o": "o{", "}|": "|{", "|o": "o|" };

const LINE_ALIASES: Readonly<Record<string, string>> = { to: "--", "optionally to": ".." };

const GLYPH = String.raw`[|}][|o]|[o|][|{]`;

const WORD_CARD = CARD_ALIASES.map(([alias]) => alias)
  .sort((a, b) => b.length - a.length)
  .map((alias) => alias.replace(/[()+]/gu, (ch) => `\\${ch}`).replaceAll(" ", String.raw`\s+`))
  .join("|");

// mermaid's `relSpec` is a cardinality, a line and a cardinality, each lexed on its own and the blanks between
// them skipped: a word or a glyph on either side, `--`, `..` or a word between. A word needs a blank off the
// name beside it, which the lexer would otherwise read as one name; `u` (MD_PARENT) stands on the left alone.
const REL_RE = new RegExp(
  String.raw`^\s*${namedEntity(1)}(?:\s*(?<glyph1>${GLYPH})|\s+(?<parent>u)(?=[-.])|\s+(?<word1>${WORD_CARD}))` +
    String.raw`(?:\s*(?<line>--|\.\.|\.-|-\.)\s*|\s+(?<lineWord>to|optionally\s+to)\s+)` +
    String.raw`(?:(?<glyph2>${GLYPH})\s*|(?<word2>${WORD_CARD})\s+)${namedEntity(2)}\s*:\s*(?<label>.+?)\s*$`,
  "iu"
);

const IDENTIFYING_LINE = "--";

export const HEADER_RE = /^erDiagram(?:-v2(?=\s|$))?/u;


export const KEYWORDS = new Set(["erdiagram", "direction", "subgraph", "end"]);

const LEFT = "left";

const RIGHT = "right";

type Side = typeof LEFT | typeof RIGHT;

// Three spellings say non-identifying in mermaid, `..`, `.-` and `-.`, and one says identifying.
export const styleOf = (line: string): LineStyle => (line.trim() === IDENTIFYING_LINE ? SOLID : DASHED);

const spoken = (words: string): string => words.trim().replace(/\s+/gu, " ").toLowerCase();

function resolveCardAlias(text: string, side: Side): Cardinality | undefined {
  const wanted = spoken(text);
  for (const [alias, leftSymbol, rightSymbol] of CARD_ALIASES) {
    if (wanted === alias) return side === LEFT ? leftSymbol : rightSymbol;
  }
  return undefined;
}

export const entityName = (quoted: string | undefined, bare: string | undefined): string => (quoted ?? bare ?? "").trim();

export interface Spec {
  entity1: string;
  entity2: string;
  card1: Cardinality;
  card2: Cardinality;
  line: string;
  label: string;
}

// A relationship statement, its two ends read the way the lexer reads each: a glyph facing its entity, or a word.
export function relationshipOf(statement: string): Spec | undefined {
  const groups = REL_RE.exec(statement)?.groups ?? undefined;
  if (groups === undefined) return undefined;
  const pick = (name: string): string | undefined => groups[name] ?? undefined;
  const cardOf = (at: 1 | 2, side: Side, facing: Readonly<Partial<Record<Cardinality, Cardinality>>>): Cardinality | undefined => {
    const glyph = oneOf(CARDINALITIES, pick(`glyph${at}`) ?? "");
    if (glyph !== undefined) return facing[glyph] ?? glyph;
    const word = pick(`word${at}`);
    return word === undefined ? undefined : resolveCardAlias(word, side);
  };
  const card1 = pick("parent") === undefined ? cardOf(1, LEFT, LEFT_CARD) : MD_PARENT;
  const card2 = cardOf(2, RIGHT, RIGHT_CARD);
  if (card1 === undefined || card2 === undefined) return undefined;
  return {
    entity1: entityName(pick("quoted1"), pick("bare1")),
    entity2: entityName(pick("quoted2"), pick("bare2")),
    card1,
    card2,
    line: pick("line") ?? LINE_ALIASES[spoken(pick("lineWord") ?? "")] ?? IDENTIFYING_LINE,
    label: pick("label") ?? "",
  };
}

// mermaid writes every cell of a row through the same `addText`, which brackets a generic before it draws it
// (`erBox.ts`), so `List~Item~` comes out `List<Item>` wherever it stands in the row.
function attributeOf(match: RegExpExecArray): Attribute {
  const written = match[3] ?? "";
  return {
    type: generics(unBackticked(match[1])),
    name: generics(unBackticked(match[2])),
    keys: listed(written),
    comment: generics(boxLabel(match[4] ?? "")),
  };
}

// Every attribute a row holds, or none when the row is not read to its end.
export function attributesOf(row: string): Attribute[] {
  const found: Attribute[] = [];
  let read = 0;
  ATTR_STEP_RE.lastIndex = 0;
  for (let match = ATTR_STEP_RE.exec(row) ?? undefined; match !== undefined; match = ATTR_STEP_RE.exec(row) ?? undefined) {
    found.push(attributeOf(match));
    read = ATTR_STEP_RE.lastIndex;
  }
  return BLANK_TAIL_RE.test(row.slice(read)) ? found : [];
}
