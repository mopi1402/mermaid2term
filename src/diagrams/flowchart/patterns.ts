import { ArrowType, EdgeStyle } from "../../graph/model.js";
import { stripChars } from "../../text/format.js";

export const MIN_LENGTH = 1;
const HEADED_BASE = 2;
const OPEN_BASE = 3;
const count = (text: string, ch: string): number => text.split(ch).length - 1;

export function computeArrowLength(arrowText: string, style: EdgeStyle): number {
  const hasHead = arrowText.trimEnd().endsWith(">") || arrowText.trimStart().startsWith("<");
  const s = stripChars(stripChars(arrowText, "<ox", true, false), ">ox", false, true);
  if (style === EdgeStyle.DOTTED) return Math.max(MIN_LENGTH, count(s, "."));
  if (style === EdgeStyle.THICK) {
    const base = hasHead ? HEADED_BASE : OPEN_BASE;
    return Math.max(MIN_LENGTH, count(s, "=") - base + 1);
  }
  if (style === EdgeStyle.SOLID) {
    const base = hasHead ? HEADED_BASE : OPEN_BASE;
    return Math.max(MIN_LENGTH, count(s, "-") - base + 1);
  }
  return MIN_LENGTH;
}

// Tried in order of specificity, the EARLIEST match winning; and `-\.+-` everywhere, never `-\.-`: a dotted run lengthens by its dots.
export const PLAIN_ARROWS: ReadonlyArray<{
  re: RegExp;
  style: EdgeStyle;
  hasStart: boolean;
  hasEnd: boolean;
  typeStart: ArrowType;
  typeEnd: ArrowType;
}> = [
  { re: /<-\.+->/, style: EdgeStyle.DOTTED, hasStart: true, hasEnd: true, typeStart: ArrowType.ARROW, typeEnd: ArrowType.ARROW },
  { re: /<=+=>/, style: EdgeStyle.THICK, hasStart: true, hasEnd: true, typeStart: ArrowType.ARROW, typeEnd: ArrowType.ARROW },
  { re: /<-+->/, style: EdgeStyle.SOLID, hasStart: true, hasEnd: true, typeStart: ArrowType.ARROW, typeEnd: ArrowType.ARROW },
  { re: /(?<=\s)o-+o/, style: EdgeStyle.SOLID, hasStart: true, hasEnd: true, typeStart: ArrowType.CIRCLE, typeEnd: ArrowType.CIRCLE },
  { re: /(?<=\s)x-+x/, style: EdgeStyle.SOLID, hasStart: true, hasEnd: true, typeStart: ArrowType.CROSS, typeEnd: ArrowType.CROSS },
  { re: /(?<=\s)o=+=o/, style: EdgeStyle.THICK, hasStart: true, hasEnd: true, typeStart: ArrowType.CIRCLE, typeEnd: ArrowType.CIRCLE },
  { re: /(?<=\s)x=+=x/, style: EdgeStyle.THICK, hasStart: true, hasEnd: true, typeStart: ArrowType.CROSS, typeEnd: ArrowType.CROSS },
  { re: /(?<=\s)o-\.+-o/, style: EdgeStyle.DOTTED, hasStart: true, hasEnd: true, typeStart: ArrowType.CIRCLE, typeEnd: ArrowType.CIRCLE },
  { re: /(?<=\s)x-\.+-x/, style: EdgeStyle.DOTTED, hasStart: true, hasEnd: true, typeStart: ArrowType.CROSS, typeEnd: ArrowType.CROSS },
  { re: /(?:<|(?<=\s)[xo])?-\.+->/, style: EdgeStyle.DOTTED, hasStart: false, hasEnd: true, typeStart: ArrowType.ARROW, typeEnd: ArrowType.ARROW },
  { re: /(?:<|(?<=\s)[xo])?=+=>/, style: EdgeStyle.THICK, hasStart: false, hasEnd: true, typeStart: ArrowType.ARROW, typeEnd: ArrowType.ARROW },
  { re: /(?:<|(?<=\s)[xo])?-+->/, style: EdgeStyle.SOLID, hasStart: false, hasEnd: true, typeStart: ArrowType.ARROW, typeEnd: ArrowType.ARROW },
  { re: /(?:<|(?<=\s)[xo])?=+=o/, style: EdgeStyle.THICK, hasStart: false, hasEnd: true, typeStart: ArrowType.ARROW, typeEnd: ArrowType.CIRCLE },
  { re: /(?:<|(?<=\s)[xo])?=+=x/, style: EdgeStyle.THICK, hasStart: false, hasEnd: true, typeStart: ArrowType.ARROW, typeEnd: ArrowType.CROSS },
  { re: /(?:<|(?<=\s)[xo])?-\.+-o/, style: EdgeStyle.DOTTED, hasStart: false, hasEnd: true, typeStart: ArrowType.ARROW, typeEnd: ArrowType.CIRCLE },
  { re: /(?:<|(?<=\s)[xo])?-\.+-x/, style: EdgeStyle.DOTTED, hasStart: false, hasEnd: true, typeStart: ArrowType.ARROW, typeEnd: ArrowType.CROSS },
  { re: /(?:<|(?<=\s)[xo])?(?:--+o|-o(?=\s|$))/, style: EdgeStyle.SOLID, hasStart: false, hasEnd: true, typeStart: ArrowType.ARROW, typeEnd: ArrowType.CIRCLE },
  { re: /(?:<|(?<=\s)[xo])?(?:--+x|-x(?=\s|$))/, style: EdgeStyle.SOLID, hasStart: false, hasEnd: true, typeStart: ArrowType.ARROW, typeEnd: ArrowType.CROSS },
  { re: /~~~/, style: EdgeStyle.INVISIBLE, hasStart: false, hasEnd: false, typeStart: ArrowType.ARROW, typeEnd: ArrowType.ARROW },
  { re: /(?:<|(?<=\s)[xo])?-\.+-/, style: EdgeStyle.DOTTED, hasStart: false, hasEnd: false, typeStart: ArrowType.ARROW, typeEnd: ArrowType.ARROW },
  { re: /(?:<|(?<=\s)[xo])?={3,}/, style: EdgeStyle.THICK, hasStart: false, hasEnd: false, typeStart: ArrowType.ARROW, typeEnd: ArrowType.ARROW },
  { re: /(?:<|(?<=\s)[xo])?-{3,}/, style: EdgeStyle.SOLID, hasStart: false, hasEnd: false, typeStart: ArrowType.ARROW, typeEnd: ArrowType.ARROW },
];

// A run too short for mermaid's lexer (`A <-- B`, `A -- B`) is read as the long one it stands for, where mermaid errs.
export const SHORT_RUN = /(?<=\s)[<xo]?(?:--|==|-\.+)(?=\s)/u;

export const PIPED_ARROW = /([xo<]?)([-=.~]+)([>ox]?)(\|)([^|]*)(\|)/;
export const ENDS_MARKED = /[>ox]$/u;
// A short piped run marked at its start reads as its long form (`<--|x|` as `<---|x|`), never given a second head.
export const START_MARKED = /^[xo<]/u;
export const OPEN_RUN = /^[xo<]?(-{3,}|={3,}|~{3,}|-\.+-)$/u;

export const SPLIT_ARROWS: ReadonlyArray<RegExp> = [
  /([xo<]?--)(\s+.+?\s+)(--+[-xo>]|--(?=\s))/,
  /([xo<]?==)(\s+.+?\s+)(==+[=xo>]|==(?=\s))/,
  /([xo<]?-\.)(\s+.+?\s+)(\.+-[xo>]?)/,
];

export const EDGE_ID_RE = /\b([a-zA-Z_]\w*)@(?=[-=.<~ox])/gu;
export const EDGE_ID_TAIL_RE = /\s*\b[a-zA-Z_]\w*@$/u;

export function classifyArrow(arrow: string): {
  style: EdgeStyle;
  hasStart: boolean;
  hasEnd: boolean;
  typeStart: ArrowType;
  typeEnd: ArrowType;
} {
  const s = arrow.trim();
  const hasStart = s.startsWith("<") || s.startsWith("o") || s.startsWith("x");
  const hasEnd = s.endsWith(">") || s.endsWith("x") || s.endsWith("o");
  let typeStart = ArrowType.ARROW;
  let typeEnd = ArrowType.ARROW;
  if (s.startsWith("o")) typeStart = ArrowType.CIRCLE;
  else if (s.startsWith("x")) typeStart = ArrowType.CROSS;
  if (s.endsWith("o")) typeEnd = ArrowType.CIRCLE;
  else if (s.endsWith("x")) typeEnd = ArrowType.CROSS;

  if (s.includes(".")) return { style: EdgeStyle.DOTTED, hasStart, hasEnd, typeStart, typeEnd };
  if (s.includes("=")) return { style: EdgeStyle.THICK, hasStart, hasEnd, typeStart, typeEnd };
  if (s.includes("~")) return { style: EdgeStyle.INVISIBLE, hasStart, hasEnd, typeStart, typeEnd };
  return { style: EdgeStyle.SOLID, hasStart, hasEnd, typeStart, typeEnd };
}

