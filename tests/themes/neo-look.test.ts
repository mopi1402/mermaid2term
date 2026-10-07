import { describe, expect, it } from "vitest";

import { renderThemed } from "../../src/index.js";
import { must } from "../../src/must.js";
import { GROUND, hexOf, INK, runsOf } from "../support/ansi.js";
import { withConfig } from "../support/frontmatter.js";

interface Cell {
  readonly ch: string;
  readonly fg: string | undefined;
  readonly bg: string | undefined;
}

// Every drawn row as its cells, each with the ink and the ground it is painted in.
const cellsOf = (painted: string): Cell[][] =>
  painted.split("\n").map((row) =>
    runsOf(row).flatMap(([codes, text]) => [...text].map((ch) => ({ ch, fg: hexOf(codes, INK), bg: hexOf(codes, GROUND) })))
  );

const light = (source: string, theme: string, extra: Record<string, unknown> = {}): Cell[][] =>
  cellsOf(renderThemed(source, { background: "light", width: 80, ...extra }, theme));

const inkRow = (cells: Cell[][], glyph: string): Cell[] => must(cells.find((row) => row.some((cell) => cell.ch === glyph)));
const inks = (row: readonly Cell[], glyph: string): Array<string | undefined> => row.filter((cell) => cell.ch === glyph).map((cell) => cell.fg);
const withTheme = (theme: string, body: string, look?: string): string =>
  withConfig(`  theme: ${theme}\n${look === undefined ? "" : `  look: ${look}\n`}`, body);

// The `nodeBorder` a sweep draws in, green, which a gradient from red to blue never lays: a cell left in it is a stroke
// the gradient missed, however the ground lifted it.
const greenOf = (fg: string | undefined): boolean => {
  const [r, g, b] = fg === undefined ? [0, 0, 0] : [1, 3, 5].map((at) => Number.parseInt(fg.slice(at, at + 2), 16));
  return g > r + 60 && g > b + 60;
};

const NEO_START = "#0042eb";
const NEO_STOP = "#eb0042";

describe("mermaid 12's `neo` look, the default of the flowchart, the state, the class, the sequence and the ER", () => {
  it.each(["LR", "TD"])("strokes a node from `gradientStart` on its left wall to `gradientStop` on its right (%s)", (dir) => {
    const cells = light(`flowchart ${dir}\n  A[Alpha box]`, "neo");
    const top = inkRow(cells, "┌");
    expect(inks(top, "┌")).toEqual([NEO_START]);
    expect(inks(top, "┐")).toEqual([NEO_STOP]);
    const rule = inks(top, "─");
    expect(new Set(rule).size).toBe(rule.length);
    expect(inks(inkRow(cells, "A"), "│")).toEqual([NEO_START, NEO_STOP]);
  });

  it.each(["LR", "TD"])("keeps every label, edge and head in its own ink, the gradient on the box alone (%s)", (dir) => {
    const source = `flowchart ${dir}\n  A[Alpha] --> B[Beta]`;
    const neo = light(withTheme("neo", source), "mono").flat();
    const classic = light(withTheme("neo", source, "classic"), "mono").flat();
    expect(neo.map((cell) => cell.ch)).toEqual(classic.map((cell) => cell.ch));
    neo.forEach((cell, at) => {
      if (!"┌┐└┘─│├┤┬┴".includes(cell.ch)) expect(cell.fg).toBe(classic[at].fg);
    });
  });

  it.each(["default", "padless"])("never moves a ground: every cell stands on the ground the classic look gives it (%s)", (borders) => {
    const source = "flowchart LR\n  subgraph S\n    A[Alpha] --> B(Beta)\n  end\n  B --> C{Q}";
    const neo = light(withTheme("neo", source), "mono", { borders }).flat();
    const classic = light(withTheme("neo", source, "classic"), "mono", { borders }).flat();
    expect(neo.map((cell) => `${cell.ch}${cell.bg ?? ""}`)).toEqual(classic.map((cell) => `${cell.ch}${cell.bg ?? ""}`));
  });

  it("gives a subgraph a gradient of its own, across its own width", () => {
    const cells = light(withTheme("neo", "flowchart LR\n  subgraph Group\n    A[Alpha] --> B[Beta]\n  end"), "mono");
    const outer = cells[0];
    expect(outer.find((cell) => cell.ch === "┌")?.fg).toBe(NEO_START);
    expect(outer.find((cell) => cell.ch === "┐")?.fg).toBe(NEO_STOP);
  });

  it("leaves a node that states its own `stroke` in that stroke, as an inline style wins over mermaid's stylesheet", () => {
    const cells = light(withTheme("neo", "flowchart LR\n  A[Alpha] --> C[Red]\n  style C stroke:#f00"), "mono");
    const row = inkRow(cells, "R");
    expect(new Set([...inks(row, "│"), ...inks(row, "├")])).toEqual(new Set([NEO_START, NEO_STOP, "#ff0000"]));
  });

  it("reads `look: classic` from the frontmatter, and the diagram's own `config.flowchart.look` over it", () => {
    const body = "flowchart LR\n  A[Alpha]";
    expect(new Set(inks(inkRow(light(withTheme("neo", body, "classic"), "mono"), "A"), "│"))).toEqual(new Set(["#000000"]));
    const own = withConfig({ theme: "neo", look: "classic", flowchart: { look: "neo" } }, body);
    expect(inks(inkRow(light(own, "mono"), "A"), "│")).toEqual([NEO_START, NEO_STOP]);
  });

  it("strokes a cluster with `nodeBorder` where the theme turns no gradient on, `clusterBorder` staying the classic look's", () => {
    const body = "flowchart LR\n  subgraph Group\n    A[Alpha]\n  end";
    expect(light(withTheme("default", body), "mono")[0].find((cell) => cell.ch === "┌")?.fg).toBe("#9370db");
    expect(light(withTheme("default", body, "classic"), "mono")[0].find((cell) => cell.ch === "┌")?.fg).toBe("#aaaa33");
  });

  it("keeps the gradient over a `nodeBorder` the source writes, as only mermaid's `base` turns it off", () => {
    const body = "flowchart LR\n  A[Alpha]";
    const bordered = (theme: string, extra = ""): string =>
      withConfig(`  theme: ${theme}\n  themeVariables:\n    nodeBorder: "#00ff00"\n${extra}`, body);
    expect(inks(inkRow(light(bordered("neo"), "mono"), "A"), "│")).toEqual([NEO_START, NEO_STOP]);
    expect(new Set(inks(inkRow(light(bordered("neo", "    useGradient: false\n"), "mono"), "A"), "│"))).toEqual(new Set(["#00ff00"]));
    expect(new Set(inks(inkRow(light(bordered("base"), "mono"), "A"), "│"))).toEqual(new Set(["#00ff00"]));
    expect(new Set(inks(inkRow(light(bordered("base", "    useGradient: true\n"), "mono"), "A"), "│")).size).toBe(2);
  });

  it.each([
    ["LR", "classic"],
    ["TD", "terra"],
    ["LR", "neon"],
    ["TD", "amber"],
    ["LR", "phosphor"],
    ["TD", "gruvbox"],
    ["LR", "monokai"],
    ["TD", "dracula"],
    ["LR", "nord"],
    ["TD", "solarized"],
  ])("strokes a theme of this package in a gradient of its own under `neo` (%s, %s)", (dir, theme) => {
    const body = `flowchart ${dir}\n  A[Alpha box]`;
    const walls = (look: string): Array<string | undefined> =>
      inks(inkRow(cellsOf(renderThemed(body, { width: 80, background: "dark", look }, theme)), "A"), "│");
    expect(new Set(walls("neo")).size).toBe(2);
    expect(walls("neo")).not.toEqual(walls("classic"));
  });

  it("leaves `mono` as it dresses its boxes, its inks being the terminal's own", () => {
    const body = "flowchart LR\n  subgraph Group\n    A[Alpha]\n  end";
    expect(renderThemed(body, { width: 80 }, "mono")).toBe(renderThemed(body, { width: 80, look: "classic" }, "mono"));
  });

  it.each([
    ["LR", "source"],
    ["TD", "source"],
    ["LR", "caller"],
    ["TD", "caller"],
  ])("strokes `mono` in a grey gradient where `neo` is asked for, not merely defaulted (%s, %s)", (dir, asker) => {
    const body = `flowchart ${dir}\n  A[Alpha box]`;
    const source = asker === "source" ? withConfig({ look: "neo" }, body) : body;
    const look = asker === "caller" ? { look: "neo" } : {};
    const walls = inks(inkRow(cellsOf(renderThemed(source, { width: 80, background: "dark", ...look }, "mono")), "A"), "│");
    expect(walls).toEqual(["#d0d0d0", "#707070"]);
  });

  it("carries a composite state's gradient through its title band and the rule under it", () => {
    const cells = light(withTheme("neo", "stateDiagram-v2\n  state Busy {\n    Work\n  }"), "mono", { borders: "padless" });
    const band = inkRow(cells, "B");
    expect(band[0].fg).toBe(NEO_START);
    expect(band[band.length - 1].fg).toBe(NEO_STOP);
  });

  it.each([
    ["LR", "default"],
    ["TD", "default"],
    ["LR", "padless"],
    ["TD", "padless"],
  ])("keeps the marks that name a circle, a rhombus and a double circle in the border's own ink (%s, %s)", (dir, borders) => {
    const source = `flowchart ${dir}\n  A((Circle)) ~~~ B{Rhombus} ~~~ C(((Double circle)))`;
    const neo = light(withTheme("neo", source), "mono", { borders }).flat();
    const classic = light(withTheme("neo", source, "classic"), "mono", { borders }).flat();
    const marks = neo.filter((cell) => "⭘◯○◎◆◇".includes(cell.ch));
    expect(marks.length).toBeGreaterThan(0);
    neo.forEach((cell, at) => {
      if ("⭘◯○◎◆◇".includes(cell.ch)) expect(cell.fg).toBe(classic[at].fg);
    });
  });

  it.each(["LR", "TD"])("carries the gradient onto a cylinder's rim, drawn on the row above its box inside a frame (%s)", (dir) => {
    const source = withTheme("neo", `flowchart ${dir}\n  subgraph Data\n    E[(PostgreSQL)]\n  end\n  X --> E`);
    const cells = light(source, "mono");
    const lid = cells.findIndex((row) => row.some((cell) => cell.ch === "("));
    const rim = cells[lid - 1].filter((cell) => cell.ch === "▁");
    expect(rim.length).toBeGreaterThan(2);
    expect(new Set(rim.map((cell) => cell.fg)).size).toBe(rim.length);
  });

  it.each([
    ["LR", "default"],
    ["TD", "default"],
    ["LR", "padless"],
    ["TD", "padless"],
  ])("leaves no stroke of any shape out of the gradient, bare, in a frame or in two (%s, %s)", (dir, borders) => {
    const head = withConfig({ theme: "base", themeVariables: { useGradient: true, gradientStart: '"#ff0000"', gradientStop: '"#0000ff"', nodeBorder: '"#00ff00"' } }, `flowchart ${dir}\n`);
    const node = (shape: string): string => `N@{ shape: ${shape}, label: "Some label" }`;
    const places = [
      (shape: string): string => `  X --> ${node(shape)} --> Y`,
      (shape: string): string => `  subgraph G\n    ${node(shape)}\n  end\n  X --> N --> Y`,
      (shape: string): string => `  subgraph O\n    subgraph G\n      ${node(shape)}\n    end\n  end\n  X --> N --> Y`,
    ];
    const shapes = "odd comment brace-r braces circle cyl diam div-rect dbl-circ framed-circle hex h-cyl hourglass lin-rect notch-rect fork lean-r lean-l rect rounded sm-circ stadium subroutine text trap-t trap-b";
    const solid = shapes.split(" ").flatMap((shape) =>
      places.flatMap((place) =>
        light(head + place(shape), "mono", { borders, width: 100 })
          .flat()
          .filter((cell) => cell.ch.trim() !== "" && !"⭘◯○◎◆◇".includes(cell.ch) && greenOf(cell.fg))
          .map((cell) => `${shape}: ${cell.ch}`)
      )
    );
    expect(solid).toEqual([]);
  });

  it.each(["LR", "TD"])("strokes a brace whole in `gradientStart`, as `docs/divergences.md` decides (%s)", (dir) => {
    const source = `flowchart ${dir}\n  A@{ shape: braces, label: "Braces" } ~~~ B@{ shape: comment, label: "Comment" } ~~~ C@{ shape: brace-r, label: "Right" }`;
    const braces = light(withTheme("neo", source), "mono").flat().filter((cell) => "⎧⎨⎩⎫⎬⎭{}".includes(cell.ch));
    expect(braces.length).toBeGreaterThan(0);
    expect(new Set(braces.map((cell) => cell.fg))).toEqual(new Set([NEO_START]));
  });
});

describe("mermaid 12's `neo` look on a class and an entity, both drawn by its unified renderer", () => {
  // The name's row, read from its first stroke to its last: the letters and the blanks between are not the stroke.
  const walls = (cells: Cell[][], name: string): Array<string | undefined> => {
    const row = inkRow(cells, name[0]).filter((cell) => cell.ch.trim() !== "" && !/[\p{L}\p{N}+_]/u.test(cell.ch));
    return [row[0]?.fg, row[row.length - 1]?.fg];
  };
  const sources = {
    class: (dir: string): string => `classDiagram\n  direction ${dir}\n  class Animal {\n    +name\n  }`,
    er: (dir: string): string => `erDiagram\n  direction ${dir}\n  ANIMAL {\n    string name\n  }`,
  };

  it.each([
    ["class", "LR", "default"],
    ["class", "TB", "default"],
    ["class", "LR", "padless"],
    ["class", "TB", "padless"],
    ["er", "LR", "default"],
    ["er", "TB", "default"],
    ["er", "LR", "padless"],
    ["er", "TB", "padless"],
  ] as const)("strokes a %s box from `gradientStart` to `gradientStop` (%s, %s)", (kind, dir, borders) => {
    const body = sources[kind](dir);
    expect(walls(light(withTheme("neo", body), "mono", { borders }), "A")).toEqual([NEO_START, NEO_STOP]);
    expect(walls(light(withTheme("neo", body, "classic"), "mono", { borders }), "A")).not.toEqual([NEO_START, NEO_STOP]);
  });

  it.each([
    ["LR", "default"],
    ["TB", "default"],
    ["LR", "padless"],
    ["TB", "padless"],
  ])("leaves no stroke of a class or an entity out of the gradient, its dividers included (%s, %s)", (dir, borders) => {
    const head = withConfig({ theme: "base", themeVariables: { useGradient: true, gradientStart: '"#ff0000"', gradientStop: '"#0000ff"', nodeBorder: '"#00ff00"', clusterBorder: '"#00ff00"' } }, "");
    const bodies = [
      `classDiagram\n  direction ${dir}\n  namespace Zoo {\n    class Animal {\n      +name\n      +eat()\n    }\n  }\n  Animal <|-- Duck`,
      `erDiagram\n  direction ${dir}\n  ANIMAL {\n    string name PK\n    int age\n  }\n  ANIMAL ||--o{ PAW : has`,
    ];
    const solid = bodies.flatMap((body) =>
      light(head + body, "mono", { borders, width: 100 })
        .flat()
        .filter((cell) => cell.ch.trim() !== "" && greenOf(cell.fg))
        .map((cell) => cell.ch)
    );
    expect(solid).toEqual([]);
  });

  it("gives a namespace a gradient of its own, as a cluster", () => {
    const cells = light(withTheme("neo", "classDiagram\n  namespace Shop {\n    class Cart\n  }"), "mono");
    const top = must(cells.find((row) => row.some((cell) => cell.ch === "┌")));
    const corners = top.filter((cell) => cell.ch === "┌" || cell.ch === "┐");
    expect(corners[0].fg).toBe(NEO_START);
    expect(corners[corners.length - 1].fg).toBe(NEO_STOP);
  });

  it("leaves a sequence in the classic stroke, mermaid laying no gradient on its actors", () => {
    const body = "sequenceDiagram\n  Alice->>Bob: hi";
    expect(renderThemed(withTheme("neo", body), { width: 80, background: "light" }, "mono")).toBe(
      renderThemed(withTheme("neo", body, "classic"), { width: 80, background: "light" }, "mono")
    );
  });
});
