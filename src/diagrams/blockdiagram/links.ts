import { ArrowType, EdgeStyle } from "../../graph/model.js";

export interface LinkKind {
  readonly style: EdgeStyle;
  readonly hasStart: boolean;
  readonly hasEnd: boolean;
  readonly typeStart: ArrowType;
  readonly typeEnd: ArrowType;
}

// mermaid's blockDB reads a link by `==` for thickness and `.-` for the dots, its heads by its first and last glyph.
const THICK = "==";
const DOTTED = ".-";

const headOf = (end: string): ArrowType | undefined => (end === "x" ? ArrowType.CROSS : end === "o" ? ArrowType.CIRCLE : undefined);

export function classifyBlockLink(link: string): LinkKind {
  const text = link.trim();
  const first = text.charAt(0);
  const last = text.charAt(text.length - 1);
  const style = text.includes(THICK) ? EdgeStyle.THICK : text.includes(DOTTED) ? EdgeStyle.DOTTED : EdgeStyle.SOLID;
  return {
    style,
    hasStart: first === "<" || headOf(first) !== undefined,
    hasEnd: last === ">" || headOf(last) !== undefined,
    typeStart: headOf(first) ?? ArrowType.ARROW,
    typeEnd: headOf(last) ?? ArrowType.ARROW,
  };
}
