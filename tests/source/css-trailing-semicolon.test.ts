import { describe, expect, it } from "vitest";
import { renderThemed } from "../../src/index.js";

const painted = (source: string): string => renderThemed(source, { width: 80 }, "default");

const KINDS = [
  { kind: "stateDiagram-v2", node: "A:::a --> B", styled: "A --> B" },
  { kind: "classDiagram", node: "class A:::a\n  A --> B", styled: "A --> B" }
];

describe("a `;` closing a `classDef` or `style` line ends the statement, the last property kept", () => {
  for (const { kind, node, styled } of KINDS) {
    for (const direction of ["TB", "LR"]) {
      const head = `${kind}\n  direction ${direction}\n`;

      it(`${kind} ${direction}: \`classDef a fill:#ff0000;\` fills A red, as without the \`;\``, () => {
        const bare = painted(`${head}  classDef a fill:#ff0000\n  ${node}\n`);
        expect(bare).toContain("48;2;255;0;0");
        expect(painted(`${head}  classDef a fill:#ff0000;\n  ${node}\n`)).toBe(bare);
      });

      it(`${kind} ${direction}: \`style A fill:#ff0000;\` fills A red, as without the \`;\``, () => {
        const bare = painted(`${head}  ${styled}\n  style A fill:#ff0000\n`);
        expect(bare).toContain("48;2;255;0;0");
        expect(painted(`${head}  ${styled}\n  style A fill:#ff0000;\n`)).toBe(bare);
      });
    }
  }

  it("mermaid's state example `classDef movement font-style:italic;` keeps its italic", () => {
    const source = (end: string): string => `stateDiagram-v2\n  classDef movement font-style:italic${end}\n  Moving:::movement --> Still\n`;
    const bare = painted(source(""));
    expect(bare).toMatch(/\x1b\[[0-9;]*\b3\b[0-9;]*mM/u);
    expect(painted(source(";"))).toBe(bare);
  });
});
