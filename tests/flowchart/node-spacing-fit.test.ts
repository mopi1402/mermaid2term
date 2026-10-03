import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";
import { widestLine } from "../../src/text/width.js";

const body = (direction: string): string => `flowchart ${direction}
  A[Alpha] --> B[Bravo] --> C[Charlie] --> D[Delta] --> E[Echo]
  A --> F[Foxtrot] --> G[Golf] --> H[Hotel]
`;
const said = (direction: string, key: string): string => `---
config:
  layout: dagre
  flowchart:
    ${key}
---
${body(direction)}`;

const CASES = ["TD", "LR"].flatMap((direction) => [30, 45, 50, 60].map((width) => [direction, width] as const));

// A spacing read from the source is where the fit starts: mermaid's default spacing draws as no key at all, at any width.
describe("a source's nodeSpacing and rankSpacing under the fit", () => {
  it.each(CASES)("leaves the fit free to tighten the gap (%s, width %i)", (direction, width) => {
    const plain = render(said(direction, "curve: basis"), { width });
    expect(render(said(direction, "nodeSpacing: 50"), { width })).toBe(plain);
    expect(render(said(direction, "rankSpacing: 50"), { width })).toBe(plain);
  });

  it.each(CASES)("tightens a wide spacing as far as the default one (%s, width %i)", (direction, width) => {
    const plain = widestLine(render(said(direction, "curve: basis"), { width }));
    for (const key of ["nodeSpacing: 200", "rankSpacing: 200"]) {
      expect(widestLine(render(said(direction, key), { width }))).toBeLessThanOrEqual(Math.max(plain, width));
    }
  });
});
