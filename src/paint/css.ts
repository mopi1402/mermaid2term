import { colourToHex } from "../colour/colours.js";
import { PROP_COLOR, PROP_STROKE, PROP_STROKE_DASHARRAY } from "../source/css.js";
import { DIM, STYLE_SEPARATOR } from "./tokens.js";

// The outline a `stroke` asks for: a `color` inks the words alone, as mermaid lays it on the label.
export function strokeStyleOf(props: CssProps): string | undefined {
  const stroke = props.get(PROP_STROKE);
  if (!stroke) return undefined;
  return colourToHex(stroke);
}

export function linkStyleOf(props: CssProps): string | undefined {
  const parts: string[] = [];
  const stroke = strokeStyleOf(props);
  if (stroke) parts.push(stroke);
  if (props.get(PROP_STROKE_DASHARRAY)) parts.push(DIM);
  return parts.length > 0 ? parts.join(STYLE_SEPARATOR) : undefined;
}

// The ink an edge's label takes from its `linkStyle`: its `color` alone, the path's stroke never reaching it.
export function linkLabelStyleOf(props: CssProps): string | undefined {
  const color = props.get(PROP_COLOR);
  return color ? colourToHex(color) : undefined;
}

export type CssProps = ReadonlyMap<string, string>;
