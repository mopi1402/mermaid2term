import { NEWLINE } from "../text/chars.js";
import type { Background } from "../colour/background.js";
import { codesCache, renderCells } from "./emit.js";
import { Text } from "./text.js";

export const CONSOLE_WIDTH = 80;

export function printToConsole(text: Text, width: number = CONSOLE_WIDTH, background?: Background): string {
  const side = text.isPainted ? undefined : background;
  const codesOf = codesCache(side);
  return text.wrap(width).map((cells) => renderCells(cells, side, codesOf)).join(NEWLINE) + NEWLINE;
}

