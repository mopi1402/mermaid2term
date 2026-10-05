import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { render, renderThemed } from "../../src/index.js";
import { parseClassDiagram } from "../../src/diagrams/classdiagram/parser.js";
import { must } from "../../src/must.js";
import { join } from "node:path";
import { withConfig } from "../support/frontmatter.js";
import { ESC } from "../../src/paint/escapes.js";

describe("a class diagram's note drawn as a POST-IT", () => {
  const source = 'classDiagram\n    note "hello"\n    Animal <|-- Duck';
  const GROUND = "48;2;255;214;51";
  const INK = "38;2;26;26;26";
  // The rule, `noteBorderColor` as mermaid strokes it, DARKENS once it stands on the slab: the same contrast pass
  // every banded glyph goes through.
  const RULE = "38;2;142;121;36";

  it("lays the ground under the whole note, its frame and the blanks either side of the word included", () => {
    const row = must(renderThemed(source, { width: 80 }, "neon")
      .split("\n")
      .find((line) => line.includes(`${INK};${GROUND}mh`)));
    expect(row).toContain(`${GROUND}m `);
    expect(row.endsWith(`\u001b[${RULE};${GROUND}m\u2502\u001b[0m`)).toBe(true);
  });

  it("writes the text in the post-it's own ink and not the page's", () => {
    expect(renderThemed(source, { width: 80 }, "neon")).toContain(`${INK};${GROUND}mh`);
  });
});

describe("a class note that reads `<br>` and hangs from the class it is FOR", () => {
  const source =
    "classDiagram\n    Animal <|-- Duck\n    Animal <|-- Fish\n" +
    '    note for Duck "can fly<br>can swim"\n    class Duck{\n        +swim()\n    }\n';
  const rowsOf = (drawn: string): string[] => drawn.split("\n");

  it("breaks the note where the tag says, and takes the tag out of the drawing", () => {
    const drawn = render(source, { width: 80 });
    expect(drawn).not.toContain("<br");
    const rows = rowsOf(drawn);
    expect(rows.findIndex((row) => row.includes("can swim")) - rows.findIndex((row) => row.includes("can fly"))).toBe(1);
  });

  it("runs a dotted tether from the note's wall to the wall of its class, on the note's first row", () => {
    const row = must(rowsOf(render(source, { width: 80 })).find((r) => r.includes("can fly")));
    expect(row).toMatch(/can fly\s+│┄┄┄┄│\s+Duck/u);
  });

  it("gives a note that floats no tether at all", () => {
    expect(render('classDiagram\n    note "Loose"\n    A <|-- B\n', { width: 60 })).not.toContain("┄");
  });
});

describe("a `namespace` drawn as a FRAME around its classes, nested where its name carries dots", () => {
  const flat = "classDiagram\nnamespace BaseShapes {\n    class Triangle\n    class Rectangle {\n      double width\n    }\n}\n";
  // The fan these tests measure is the one a top to bottom drawing forks, so the header names the direction the
  // default no longer carries.
  const downwards = (source: string): string => source.replace("classDiagram", "classDiagram\n    direction TB");
  const nested = downwards(readFileSync(join("fixtures", "class", "namespaces.mmd"), "utf8"));
  const rowsOf = (drawn: string): string[] => drawn.split("\n");

  it("frames the classes it names, the label on the frame's second row, one blank between a wall and a box", () => {
    const parsed = parseClassDiagram(flat);
    expect(parsed.warnings).toEqual([]);
    expect(parsed.namespaces).toEqual([{ id: "BaseShapes", label: "BaseShapes", explicit: true, classes: ["Triangle", "Rectangle"], children: [] }]);
    const rows = rowsOf(render(flat, { width: 60 }));
    const lid = rows.findIndex((r) => r.trim() !== "");
    expect(rows[lid].trim()).toMatch(/^┌─+┐$/u);
    expect(rows[lid + 1].trim()).toMatch(/^│\s+BaseShapes\s+│$/u);
    expect(rows[lid + 3]).toMatch(/^\s*│ ┌/u);
  });

  it("reads a `[\"label\"]` on the namespace and takes it for the frame", () => {
    const drawn = render('classDiagram\n    namespace Auth["Authentication Service"] {\n        class UserService\n    }\n', { width: 60 });
    expect(drawn).toContain("│ Authentication Service │");
    expect(drawn).not.toContain("Auth ");
  });

  it("nests a dotted name, each segment its own frame, and draws an edge across the frames with its chip", () => {
    const parsed = parseClassDiagram(nested);
    expect(parsed.namespaces.map((ns) => ns.label)).toEqual(["Company"]);
    expect(parsed.namespaces[0]?.children[0]?.label).toBe("Engineering");
    expect(parsed.namespaces[0]?.children[0]?.children.map((ns) => ns.label)).toEqual(["Backend", "Frontend"]);
    expect(parsed.namespaces[0]?.children[0]?.classes).toEqual(["TechLead"]);
    const rows = rowsOf(render(nested, { width: 100 }));
    const company = rows.findIndex((r) => r.includes("Company"));
    const engineering = rows.findIndex((r) => r.includes("Engineering"));
    const backend = rows.findIndex((r) => r.includes("Backend"));
    expect(company).toBeLessThan(engineering);
    expect(engineering).toBeLessThan(backend);
    expect(rows[backend].slice(0, rows[backend].indexOf("Backend")).split("│").length - 1).toBe(3);
    expect(rows.filter((r) => r.includes("leads"))).toHaveLength(1);
    expect((must(rows.find((r) => r.includes("leads")))).split("leads")).toHaveLength(3);
    expect(rows.join("\n")).toMatch(/┌─+│─+┐/u);
    expect(rows[backend]).toContain("Frontend");
  });

  it("nests a namespace opened INSIDE another by its braces, the way a dotted name nests", () => {
    const source =
      "classDiagram\n    namespace Platform {\n        namespace Auth {\n            class UserService\n        }\n" +
      "        namespace Data {\n            class Repository\n        }\n        class Gateway\n    }\n" +
      "    Gateway --> UserService : delegates\n";
    const parsed = parseClassDiagram(source);
    expect(parsed.namespaces).toHaveLength(1);
    expect(parsed.namespaces[0]?.classes).toEqual(["Gateway"]);
    expect(parsed.namespaces[0]?.children.map((ns) => ns.label)).toEqual(["Auth", "Data"]);
    const rows = rowsOf(render(source, { width: 80 }));
    const gateway = must(rows.find((r) => r.includes("Gateway")));
    expect(gateway).toMatch(/^│/u);
    expect((must(rows.find((r) => r.trim() !== ""))).trim()).toMatch(/^┌─+┐$/u);
    expect(rows.findIndex((r) => r.includes("Platform"))).toBeLessThan(rows.findIndex((r) => r.includes("Auth")));
  });

  it("draws them COMPACT where the frontmatter's config asks: declared ones only, flat, whole dotted id as label", () => {
    const body =
      "classDiagram\n    namespace Company {\n        class CEO\n    }\n    namespace Company.Engineering.Backend {\n" +
      "        class Developer\n    }\n    CEO --> Developer : oversees\n";
    const compact = render(withConfig({ class: { hierarchicalNamespaces: false } }, downwards(body)), { width: 80 });
    expect(compact).toContain("│ Company.Engineering.Backend │");
    expect(compact.split("Engineering")).toHaveLength(2);
    const rows = rowsOf(compact);
    const company = rows.findIndex((r) => /│\s+Company\s+│/u.test(r));
    const backend = rows.findIndex((r) => r.includes("Company.Engineering.Backend"));
    expect(rows.slice(company, backend).some((r) => r.trim().startsWith("└"))).toBe(true);
    expect(rows[backend]).toMatch(/^│/u);
    const nested = render(downwards(body), { width: 80 });
    expect(nested).toContain("Engineering");
    expect(nested).not.toContain("Company.Engineering.Backend");
  });

  it("leaves a class outside every namespace where it was, beside the frames", () => {
    const drawn = render("classDiagram\n    namespace N {\n        class In\n    }\n    class Out\n", { width: 60 });
    expect(drawn).toContain("Out");
    expect(drawn.split("┌").length).toBe(4);
  });

  it("bends a fan halfway down the gap to the frame, its chips right under the fork, and no blank rows over it", () => {
    const drawn = render(downwards(readFileSync("fixtures/class/namespaces.mmd", "utf8")), { width: 80 });
    const rows = drawn.split("\n");
    const bottom = rows.findIndex((r) => r.includes("planSprint")) + 1;
    expect(rows[bottom + 1]).toMatch(/│ │\s+│ │\s+│ │/u);
    expect(rows[bottom + 2]).toMatch(/╭─+╯ ╰─+╮/u);
    expect(rows[bottom + 3]).toMatch(/leads\s+leads/u);
    expect(rows[bottom + 5]).toMatch(/┌─+│─+┐\s+┌─+│─+┐/u);
  });
});

describe("a `namespace` dressed as the cluster it is, the way a flowchart subgraph is dressed", () => {
  // The run of codes a given glyph is written in, whatever kind drew it.
  const runsOf = (painted: string, ch: string): string[] =>
    painted.split(ESC).flatMap((run) => {
      const found = /^\[([0-9;:]*)m(.)/u.exec(run) ?? undefined;
      return found !== undefined && found[2] === ch ? [found[1]] : [];
    });
  // The outermost frame's own rule: the last drawn row is the cluster's floor in both kinds.
  const outerRule = (painted: string): string => {
    const rows = painted.split("\n").filter((row) => row.trim() !== "");
    return must(must(/\[([0-9;:]*)m\u2514/u.exec(must(rows[rows.length - 1])) ?? undefined)[1]);
  };

  it("writes the frame and its label in the subgraph's own inks, and lays the cluster ground inside", () => {
    const namespaced = renderThemed(
      "classDiagram\n    direction TB\n    namespace Backend {\n        class Dev\n    }\n    Lead --> Dev\n",
      { width: 60 },
      "default"
    );
    const subgraphed = renderThemed("flowchart TB\n    subgraph Backend\n        Dev\n    end\n    Lead --> Dev\n", { width: 60 }, "default");
    expect(outerRule(namespaced)).toBe(outerRule(subgraphed));
    const ground = must(must(/48;2;\d+;\d+;\d+/u.exec(must(runsOf(subgraphed, "B")[0])) ?? undefined)[0]);
    expect(must(runsOf(namespaced, "B")[0])).toContain(ground);
    // The blank cells between a wall and the box it holds carry the same ground, and not the page's.
    expect(namespaced).toContain(`${ESC}[${ground}m `);
  });
});
