import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";
import { TWO_PANES } from "../support/drawn.js";

const WALLS = /[│┃║├┤]/;

// The blank cells between a line and the walls of the box it stands in.
function gaps(drawing: string, line: string): { left: number; right: number } {
  const row = drawing.split("\n").find((text) => new RegExp(`${WALLS.source} *${line} *${WALLS.source}`).test(text));
  if (row === undefined) throw new Error(`no box row holds ${line} alone`);
  const at = row.indexOf(line);
  const open = row.slice(0, at).search(new RegExp(`${WALLS.source} *$`));
  const close = row.slice(at + line.length).search(WALLS);
  return { left: at - open - 1, right: close };
}

const LABEL = "abcd<br/>abc";

describe("an odd leftover column goes to the right of a centred text", () => {
  for (const [name, source] of [
    ["a flowchart node TD", `flowchart TD\n  A["${LABEL}"]\n`],
    ["a flowchart node LR", `flowchart LR\n  A["${LABEL}"] --> B[xy]\n`],
    ["a sequence actor", `sequenceDiagram\n  participant A as ${LABEL}\n  participant B as Bob\n  A->>B: hi\n`],
  ] satisfies Array<[string, string]>) {
    for (const width of TWO_PANES) {
      it(`${name} at ${width} columns`, () => {
        const { left, right } = gaps(render(source, { width }), "abc");
        expect(right).toBe(left + 1);
      });
    }
  }
});
