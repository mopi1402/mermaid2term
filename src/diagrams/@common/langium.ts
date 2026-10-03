import { SPACE } from "../../text/chars.js";

// The terminals mermaid's langium grammars share through `common.langium` (parser 1.2.1), a `%%` comment closing
// any statement: `STRING` quoted either way with `\` escapes, and the `TITLE` statement.
export const STRING = String.raw`"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'`;
export const COMMENT = String.raw`(?:%%.*)?`;
// The quotes a langium `STRING` opens with, inside which `%%` is text.
export const LANGIUM_QUOTES = `"'`;
const TITLE_RE = new RegExp(String.raw`^title(?:[\t ](.*?))?${COMMENT}$`, "u");

const ESCAPE = "\\";
// Langium's `convertEscapeCharacter`; the SVG text mermaid draws shows a whitespace control as one space.
const ESCAPED = new Map([
  ["n", SPACE],
  ["r", SPACE],
  ["t", SPACE],
  ["f", SPACE],
  ["v", SPACE],
  ["b", ""],
  ["0", ""],
]);

// Langium's `convertString`: the quotes dropped, each `\x` read as `x` unless it names a control.
export function unquoted(written: string): string {
  let out = "";
  for (let at = 1; at < written.length - 1; at++) {
    const char = written[at];
    if (char !== ESCAPE) {
      out += char;
      continue;
    }
    at++;
    out += ESCAPED.get(written[at]) ?? written[at];
  }
  return out;
}

// The common value converter of mermaid's parser: trimmed, runs of blanks read as one.
const titleText = (written: string): string => written.trim().replace(/[\t ]{2,}/gu, SPACE);

// A `title` statement's text, `undefined` for a line that is not one.
export const titleOf = (statement: string): string | undefined => {
  const title = TITLE_RE.exec(statement) ?? undefined;
  return title === undefined ? undefined : titleText(title[1] ?? "");
};
