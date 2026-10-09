import { centredAt, displayWidth, truncateToWidth } from "../../text/width.js";
import { BORDER, MIN_LABEL } from "./metrics.js";

export type Span = readonly [number, number];
const roomIn = (span: Span): number => Math.max(0, span[1] - span[0] + 1);

export function labelSeat(
  title: string,
  from: number,
  to: number,
  left: Span,
  right: Span,
  milestone: boolean
): { at: number; text: string; inside: boolean } | undefined {
  const width = displayWidth(title);
  const inside = milestone ? 0 : Math.max(0, to - from + 1 - 2 * BORDER);
  const centred = (text: string): number => from + BORDER + centredAt(inside, text);
  if (width <= inside) return { at: centred(title), text: title, inside: true };
  if (width <= roomIn(right)) return { at: right[0], text: title, inside: false };
  if (width <= roomIn(left)) return { at: left[1] - width + 1, text: title, inside: false };

  const best = Math.max(inside, roomIn(right), roomIn(left));
  if (best < MIN_LABEL) return undefined;
  if (best === inside) {
    const cut = truncateToWidth(title, inside);
    return { at: centred(cut), text: cut, inside: true };
  }
  if (best === roomIn(right)) return { at: right[0], text: truncateToWidth(title, best), inside: false };
  const cut = truncateToWidth(title, best);
  return { at: left[1] - displayWidth(cut) + 1, text: cut, inside: false };
}
