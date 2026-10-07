import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";
import { withConfig } from "../support/frontmatter.js";

const LONG = "this is a rather long message that should fold somewhere along the way";
const SEQUENCE = `sequenceDiagram\n    Alice->>Bob: ${LONG}\n`;
const drawn = (source: string): string => render(source, { width: 200 });
const folded = drawn(withConfig({ sequence: { wrap: true } }, SEQUENCE));
const flat = drawn(SEQUENCE);

// mermaid 12, headless: a global `wrap: true` folds a sequence's messages as `sequence.wrap: true` does, and a
// global `false` does not unfold what `sequence.wrap: true` asked.
describe("mermaid's global `wrap`, which only a sequence reads", () => {
  it("folds the messages as `sequence.wrap` does", () => {
    expect(folded).not.toBe(flat);
    expect(drawn(withConfig({ wrap: true }, SEQUENCE))).toBe(folded);
    expect(drawn(withConfig({ wrap: true, sequence: { wrap: false } }, SEQUENCE))).toBe(folded);
  });

  it("reads the init directive and the bare `%%{wrap}%%` alike", () => {
    expect(drawn(`%%{init: {"wrap": true}}%%\n${SEQUENCE}`)).toBe(folded);
    expect(drawn(`%%{wrap}%%\n${SEQUENCE}`)).toBe(folded);
  });

  it("leaves `sequence.wrap: true` standing under a global `false`", () => {
    expect(drawn(withConfig({ wrap: false, sequence: { wrap: true } }, SEQUENCE))).toBe(folded);
    expect(drawn(withConfig({ wrap: false }, SEQUENCE))).toBe(flat);
  });

  it("keeps a `nowrap:` message whole", () => {
    const kept = `sequenceDiagram\n    Alice->>Bob: nowrap:${LONG}\n`;
    expect(drawn(withConfig({ wrap: true }, kept))).toContain(LONG);
  });

  it.each(["TD", "LR"])("says nothing to a flowchart (%s)", (dir) => {
    const body = `flowchart ${dir}\n    A["${LONG}"] --> B[short]\n`;
    expect(drawn(withConfig({ wrap: true }, body))).toBe(drawn(body));
  });
});
