import { makePacket, type Packet } from "./model.js";
import { contentLines, headerBody } from "../../source/lines.js";
import { flagOf, type Declared } from "../../source/config.js";
import { numberOf } from "../../text/format.js";
import { LANGIUM_QUOTES, STRING, titleOf, unquoted } from "../@common/langium.js";
import { withoutAccessible } from "../@common/accessible.js";

// A quoted `STRING` unquoted as mermaid converts it, or the loose text this reader has always taken.
const LABEL = String.raw`\s*:\s*(?:(${STRING})|"?([^"]*)"?)`;
const RANGE_RE = new RegExp(String.raw`^(\d+)\s*-\s*(\d+)${LABEL}`, "u");
const RELATIVE_RE = new RegExp(String.raw`^\+\s*(\d+)${LABEL}`, "u");
const SINGLE_RE = new RegExp(String.raw`^(\d+)${LABEL}`, "u");

const HEADER_RE = /^\s*packet(?:-beta)?/u;
const BITS_PER_ROW_KEY = "bitsPerRow";
const SHOW_BITS_KEY = "showBits";

const labelOf = (quoted: string | undefined, loose: string | undefined): string =>
  quoted === undefined ? (loose ?? "").trim() : unquoted(quoted);

export function parsePacket(text: string, said: Declared = {}): Packet {
  const lines = contentLines(text, LANGIUM_QUOTES);
  const packet = makePacket();
  const rowBits = numberOf(said[BITS_PER_ROW_KEY] ?? "");
  if (rowBits !== undefined && Number.isInteger(rowBits) && rowBits > 0) packet.rowBits = rowBits;
  packet.showBits = flagOf(said, SHOW_BITS_KEY) ?? true;
  if (lines.length === 0) return packet;

  let next = 0;
  // mermaid needs no line end after the keyword: a block may follow it on its line.
  for (const stripped of withoutAccessible(headerBody(lines, HEADER_RE))) {
    const title = titleOf(stripped);
    if (title !== undefined) {
      packet.title = title;
      continue;
    }

    // mermaid throws on a block that ends before it starts or runs back over the one before: it is dropped here.
    const range = RANGE_RE.exec(stripped) ?? undefined;
    if (range !== undefined) {
      const start = Number.parseInt(range[1], 10);
      const end = Number.parseInt(range[2], 10);
      if (end < start || start < next) continue;
      packet.fields.push({ start, end, label: labelOf(range[3], range[4]) });
      next = end + 1;
      continue;
    }

    const relative = RELATIVE_RE.exec(stripped) ?? undefined;
    if (relative !== undefined) {
      const end = next + Number.parseInt(relative[1], 10) - 1;
      packet.fields.push({ start: next, end, label: labelOf(relative[2], relative[3]) });
      next = end + 1;
      continue;
    }

    const single = SINGLE_RE.exec(stripped) ?? undefined;
    if (single !== undefined) {
      const start = Number.parseInt(single[1], 10);
      if (start < next) continue;
      packet.fields.push({ start, end: start, label: labelOf(single[2], single[3]) });
      next = start + 1;
    }
  }

  return packet;
}
