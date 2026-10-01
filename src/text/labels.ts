import { NEWLINE } from "./chars.js";
import { htmlDecoded } from "./entities.js";
import { centredAt, truncateToWidth, widestOf, wordWrap } from "./width.js";

export const BR_RE = /<\/?br\s*\/?>/giu;
const SPACED_BR_RE = /\s*<\/?br\s*\/?>\s*/giu;

export const LITERAL_NEWLINE = "\\n";

// A title held whole on one line while `room` allows it, folded on words past it, a lone word too wide cut.
export const titleLines = (title: string, room: number): string[] => wordWrap(title, room).map((line) => truncateToWidth(line, room));

// A box's label as mermaid's html label draws it: a row per `<br>`, each character reference the character it names.
export const boxLabel = (text: string): string => htmlDecoded(text.replace(BR_RE, LITERAL_NEWLINE));

// A label drawn along a line, a row per `<br>` as mermaid's html label breaks it, the blanks around the tag dropped.
export const lineLabel = (text: string): string => htmlDecoded(text.replace(SPACED_BR_RE, LITERAL_NEWLINE));

export const labelRowsOf = (label: string, separator: string = LITERAL_NEWLINE): string[] => label.split(separator);

export const widestLabelLine = (label: string, separator: string = LITERAL_NEWLINE): number => widestOf(labelRowsOf(label, separator));

// Each row of a label with the cells it stands in from the block's left, centred in the widest as mermaid centres them.
export const centredLabelRows = (label: string): Array<readonly [number, string]> => {
  const width = widestLabelLine(label);
  return labelRowsOf(label).map((row): readonly [number, string] => [centredAt(width, row), row]);
};

export function labelLines(label: string): number {
  if (label.includes(NEWLINE)) return label.split(NEWLINE).length;
  if (label.includes(LITERAL_NEWLINE)) return label.split(LITERAL_NEWLINE).length;
  return 1;
}

// mermaid 12's `fa:fa-car` is an empty `<i>` without FontAwesome's stylesheet, the blanks either side collapsing.
const FONT_AWESOME_RE = /fa[bklrs]?:fa-[\w-]+/gu;

export function unIconed(text: string): string {
  const bare = text.replace(FONT_AWESOME_RE, "");
  return bare === text ? text : bare.replace(/\s{2,}/gu, " ").trim();
}
