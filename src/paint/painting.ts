import { NEWLINE, withoutControls } from "../text/chars.js";
import { Text } from "./text.js";

// A drawing's text known at once and its styles laid only when asked: the fit weighs every try by its text and
// paints the one it keeps.
export interface Painting {
  readonly plain: string;
  readonly text: () => Text;
}

export function painting(lines: readonly string[], lay: (text: Text) => void): Painting {
  const plain = withoutControls(lines.join(NEWLINE));
  let laid: Text | undefined;
  return {
    plain,
    text: () => {
      if (laid === undefined) {
        laid = new Text(plain);
        lay(laid);
        laid.bridgeUnderlines();
      }
      return laid;
    },
  };
}

export const blankPainting = (): Painting => painting([], () => undefined);
