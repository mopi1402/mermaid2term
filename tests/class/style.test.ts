import { describe, it, expect } from "vitest";
import { render, renderThemed } from "../../src/index.js";
import { ESC, hyperlinkOpen } from "../../src/paint/escapes.js";
import { parseClassDiagram } from "../../src/diagrams/classdiagram/parser.js";

describe("a class's `style`, `classDef`, `cssClass` and `:::`, mermaid's four ways of dressing a box", () => {
  const source =
    "classDiagram\n    class Animal\n    class Mineral\n" +
    "    style Animal fill:#f9f,stroke:#333,stroke-width:4px\n" +
    "    style Mineral fill:#bbf,stroke:#f66,stroke-width:2px,color:#fff,stroke-dasharray: 5 5\n";
  const runsOf = (painted: string, ch: string): string[] =>
    painted.split(ESC).flatMap((run) => {
      const found = /^\[([0-9;:]*)m(.)/u.exec(run) ?? undefined;
      return found !== undefined && found[2] === ch ? [found[1]] : [];
    });

  it("draws a `stroke-width` of 4px HEAVY and a `stroke-dasharray` DASHED, in the plain render too", () => {
    const drawn = render(source, { width: 60 });
    expect(drawn).toMatch(/┏━+┓/u);
    expect(drawn).toMatch(/┃\s+Animal\s+┃/u);
    expect(drawn).toMatch(/┠─+┨/u);
    expect(drawn).toMatch(/┏(━ )+┓/u);
    expect(drawn).toMatch(/\u2579\s+Mineral\s+\u2579/u);
  });

  it("writes the border in the `stroke`, the words in the `color`, and lays the `fill` under blanks and words alike", () => {
    const painted = renderThemed(source, { width: 60 }, "classic");
    for (const run of runsOf(painted, "\u2501")) expect(run).toMatch(/38;2;(51;51;51|255;102;102)/u);
    expect(runsOf(painted, "\u250f")).toHaveLength(2);
    for (const run of runsOf(painted, "\u2579")) expect(run).toContain("38;2;255;102;102");
    expect(render(source, { width: 60 })).toMatch(/\u2579(─ )+\u2579/u);
    for (const run of runsOf(painted, "\u2500")) expect(run).toMatch(/38;2;(51;51;51|255;102;102)/u);
    const capital = runsOf(painted, "M");
    expect(capital.length).toBeGreaterThan(0);
    for (const run of capital) expect(run).toContain("38;2;255;255;255");
    for (const run of capital) expect(run).toContain("48;2;187;187;255");
    expect(painted).toContain("48;2;255;153;255m ");
    for (const run of runsOf(painted, "A")) expect(run).not.toContain("38;2;255;255;255");
  });

  it("dresses a class through `classDef` worn as `:::name`, as `cssClass`, or as `default`", () => {
    const dressed =
      "classDiagram\n    classDef plant fill:#dfd\n    classDef default stroke:#f66\n" +
      "    class Plant:::plant\n    class Rock\n    cssClass \"Rock\" plant\n    class Plain\n";
    const painted = renderThemed(dressed, { width: 70 }, "classic");
    expect(painted.split("48;2;221;255;221m ").length).toBeGreaterThan(2);
    for (const run of runsOf(painted, "\u250c")) expect(run).toContain("38;2;255;102;102");
    expect(runsOf(painted, "\u250c")).toHaveLength(3);
  });

  it("does nothing for a `style` on a class not yet declared, and paints nothing for `transparent`", () => {
    const lost = "classDiagram\n    style Ghost fill:#f9f\n    class Ghost\n    class Glass\n    style Glass fill:transparent\n";
    const painted = renderThemed(lost, { width: 60 }, "classic");
    expect(painted).not.toContain("48;2;");
    expect(render(lost, { width: 60 })).toMatch(/│\s+Ghost\s+│/u);
  });

  it("draws no ring and no divider for a `stroke-width` of 0, the fill alone saying where the box is", () => {
    const naked = "classDiagram\n    class Ghost {\n        +boo()\n    }\n    style Ghost fill:#f9f,stroke-width:0\n";
    const drawn = render(naked, { width: 60 });
    expect(drawn).not.toMatch(/[│─┌┐└┘├┤]/u);
    expect(drawn).toContain("Ghost");
    expect(drawn).toContain("+boo()");
    const painted = renderThemed(naked, { width: 60 }, "classic");
    expect(painted.split("\n").filter((row) => row.includes("48;2;255;153;255"))).toHaveLength(7);
  });
});

describe("a class's `link` and `click href`, the NAME made a hyperlink", () => {
  const source =
    'classDiagram\ndirection TB\nclass Shape\nlink Shape "https://www.github.com" "This is a tooltip for a link"\nclass Shape2\n' +
    'click Shape2 href "https://www.github.com" "This is a tooltip for a link"\nclass Plain\nclick Plain call f()\n' +
    'link Nope "https://x.y"\nclass Evil\nlink Evil "javascript:alert(1)"\n';
  const OSC_OPEN = hyperlinkOpen("https://www.github.com");

  it("opens one hyperlink per linked class, under the name and nowhere else", () => {
    const painted = renderThemed(source, { width: 90 }, "classic");
    expect(painted.split(OSC_OPEN).length - 1).toBe(2);
    const plain = render(source, { width: 90 }).split("\n");
    const nameRow = plain.findIndex((row) => row.includes("Shape2"));
    painted.split("\n").forEach((row, index) => {
      if (index !== nameRow) expect(row).not.toContain(OSC_OPEN);
    });
  });

  it("writes nothing of the tooltip, and links neither a callback, an unknown class nor a javascript: URL", () => {
    const drawn = render(source, { width: 90 });
    expect(drawn).not.toContain("tooltip");
    expect(parseClassDiagram(source).classes.get("Plain")?.link).toBeUndefined();
    expect(parseClassDiagram(source).classes.has("Nope")).toBe(false);
    expect(parseClassDiagram(source).classes.get("Evil")?.link).toBeUndefined();
  });
});
