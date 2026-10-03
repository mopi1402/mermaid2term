import { describe, it, expect } from "vitest";
import { render, renderThemed, BORDER_MODES } from "../../src/index.js";

describe.each(["TD", "LR"])("a folded box whose title wraps, flowchart %s", (direction) => {
  const source = [
    `flowchart ${direction}`,
    "  Start --> une",
    "  subgraph une [Chaine de collecte]",
    "    lit --> valide",
    "  end",
    "  une --> Fin[archive]",
    "  une@{ view: collapsed }",
  ].join("\n");

  it.each(BORDER_MODES)("keeps every title row above the fold rule and the dots, borders %s", (borders) => {
    const rows = render(source, { width: 80, borders }).split("\n");
    const first = rows.findIndex((row) => row.includes("Chaine de"));
    expect(first).toBeGreaterThan(-1);
    const column = rows[first].indexOf("Chaine de");
    const at = (row: number): string => rows[row].slice(column - 3, column + 12);
    expect(at(first + 1)).toContain("collecte");
    expect(at(first + 2)).toMatch(/─{5,}/u);
    expect(at(first + 3)).toContain("•••");
  });

  it.each(BORDER_MODES)("lays the box's fill under the fold rule and every blank around the title, borders %s", (borders) => {
    const rows = renderThemed(source, { width: 80, borders }, "default").split("\n");
    const fill = "48;2;236;236;255m";
    const rule = rows.find((row) => row.includes("\u001b[2;90;"));
    expect(rule).toBeDefined();
    expect(rule).toContain(`\u001b[2;90;${fill}─`);
    const second = rows.find((row) => row.includes("collecte"));
    expect(second).toContain(`\u001b[${fill}  \u001b[0m\u001b[1;38;2;51;51;51;${fill}collecte`);
  });
});
