import { describe, expect, it } from "vitest";
import { renderThemed } from "../../src/index.js";

const source = (direction: string, key: string): string => `---
config:
  themeVariables:
    ${key}: "#ff0000"
---
flowchart ${direction}
    Start --> une
    subgraph une [Collect]
        lit --> ecrit
    end
    une@{ view: collapsed }
`;

// The fold rule of a collapsed group: a run of horizontals alone, between the name and the fold mark.
const ruleInks = (drawn: string): string[] =>
  [...drawn.matchAll(/\x1b\[([0-9;]*)m(─{3,})/gu)].map((m) => /38;2;(\d+);(\d+);(\d+)/u.exec(m[1])?.slice(1).join(",") ?? "");

// A key of our own, mermaid has no faint ink: `m2t_faintColor` inks the rule, the bare `faintColor` is read no more.
describe("m2t_faintColor", () => {
  it.each(["TD", "LR"])("inks a collapsed group's fold rule (%s)", (direction) => {
    expect(ruleInks(renderThemed(source(direction, "m2t_faintColor"), { width: 80 }, "default"))).toContain("255,0,0");
  });

  it.each(["TD", "LR"])("is not read under mermaid's namespace (%s)", (direction) => {
    expect(ruleInks(renderThemed(source(direction, "faintColor"), { width: 80 }, "default"))).not.toContain("255,0,0");
  });
});
