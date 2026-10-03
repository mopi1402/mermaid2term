import { ArrowType, EdgeStyle } from "../../graph/model.js";
import { MIN_LENGTH } from "./patterns.js";

const AMPERSAND = "&";
const OPENERS = "([{";
const CLOSERS = ")]}";

export interface Segment {
  text: string;
  isArrow: boolean;
  edgeStyle: EdgeStyle;
  hasArrowStart: boolean;
  hasArrowEnd: boolean;
  arrowTypeStart: ArrowType;
  arrowTypeEnd: ArrowType;
  label: string;
  minLength: number;
  edgeId: string;
}

export function makeSegment(fields: Partial<Segment> & { text: string }): Segment {
  return {
    edgeId: "",
    isArrow: false,
    edgeStyle: EdgeStyle.SOLID,
    hasArrowStart: false,
    hasArrowEnd: true,
    arrowTypeStart: ArrowType.ARROW,
    arrowTypeEnd: ArrowType.ARROW,
    label: "",
    minLength: MIN_LENGTH,
    ...fields,
  };
}

export interface ArrowMatch {
  pos: number;
  end: number;
  style: EdgeStyle;
  hasStart: boolean;
  hasEnd: boolean;
  label: string;
  length: number;
  typeStart: ArrowType;
  typeEnd: ArrowType;
}

export function splitAmpersand(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current: string[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (OPENERS.includes(ch)) {
      depth++;
      current.push(ch);
    } else if (CLOSERS.includes(ch)) {
      depth = Math.max(0, depth - 1);
      current.push(ch);
    } else if (depth === 0 && ch === AMPERSAND && i > 0 && text[i - 1] === " ") {
      if (i + 1 < text.length && text[i + 1] === " ") {
        const part = current.join("").trimEnd();
        if (part !== "") parts.push(part);
        current = [];
        i += 2;
        continue;
      }
      current.push(ch);
    } else {
      current.push(ch);
    }
    i++;
  }
  const last = current.join("").trim();
  if (last !== "") parts.push(last);
  return parts;
}
