import { describe, it, expect } from "vitest";
import { render, renderThemed } from "../../src/index.js";
import { must } from "../../src/must.js";
import { stripSgr } from "../support/ansi.js";

describe("`borderless`, a box drawn as a SLAB of its fill", () => {
  const slab = (source: string, options = {}): string =>
    stripSgr(renderThemed(source, { width: 80, borders: "borderless", background: "light", ...options }, "default"));

  it("redraws a node's border as half blocks and cuts a hole where an edge met it", () => {
    const rows = slab("flowchart LR\n    A[Left] --> B[Right]").split("\n");
    expect(rows[0]).toMatch(/^▗▄+▖\s+▗▄+▖$/u);
    expect(rows.find((row) => row.includes("Left"))).toMatch(/^▐\s+Left\s+─+⏵▐\s+Right\s+▌$/u);
    expect(must(rows.at(-1))).toMatch(/^▝▀+▘\s+▝▀+▘$/u);
  });

  it("draws a SLOPE as a triangle of the fill, by the flank it stands on, and a sheared shape's flats as fill", () => {
    const rows = slab("flowchart LR\n    A[/Para/] --> B[\\Alt\\] --> C[/Trap\\] --> D[\\Inv/]").split("\n");
    expect(rows[0]).toMatch(/^\s+◢\s+◤\s+◥\s+◣\s+◢\s+◣\s+◥\s+◤\s*$/u);
    expect(rows.find((row) => row.includes("Para"))).toMatch(/^\s*◢\s+Para\s+◤\s+─+⏵\s+◥\s+Alt\s+◣/u);
    expect(rows.join("\n")).not.toMatch(/[╱╲▔▁]/u);
  });

  it("gives a hexagon triangle shoulders on its flats and Powerline points in the fill's colour", () => {
    const source = "flowchart LR\n    A{{Hex}} --> B[Box]";
    const rows = slab(source).split("\n");
    expect(rows[0]).toMatch(/^\s+◢\s+◣\s+▗▄+▖$/u);
    expect(rows.find((row) => row.includes("Hex"))).toMatch(/^\ue0b2\s+Hex\s+\ue0b0─+⏵▐\s+Box\s+▌$/u);
    expect(must(rows.at(-1))).toMatch(/^\s+◥\s+◤\s+▝▀+▘$/u);
    const drawn = renderThemed(source, { width: 80, borders: "borderless", background: "light" }, "default");
    expect(drawn).toContain("\u001b[38;2;236;236;255m\ue0b2\u001b[0m");
    expect(drawn).toContain("\u001b[38;2;236;236;255m\ue0b0\u001b[0m");
  });

  it("draws a CARD as its fill alone, the cut corner a triangle on the first filled row, no ring around it", () => {
    const source = "flowchart LR\n    A[Box] --> B@{ shape: notch-rect, label: \"Card\" } --> C[Box]";
    const rows = slab(source).split("\n");
    expect(rows[0]).toMatch(/^▗▄+▖\s+▗▄+▖$/u);
    expect(rows[1]).toMatch(/^▐\s+▌\s+◢\s+▐\s+▌$/u);
    expect(rows[2]).toMatch(/^▐\s+Box\s+─+⏵\s+Card\s+─+⏵▐\s+Box\s+▌$/u);
    expect(rows[3]).toMatch(/^▐\s+▌\s+▐\s+▌$/u);
    expect(rows[4]).toMatch(/^▝▀+▘\s+▝▀+▘$/u);
    const plain = render(source, { width: 80 }).split("\n");
    expect(rows[1].indexOf("◢")).toBe(plain[3].indexOf("│", 9));
    const drawn = renderThemed(source, { width: 80, borders: "borderless", background: "light" }, "default");
    expect(drawn).toContain("\u001b[38;2;236;236;255m◢\u001b[0m\u001b[48;2;236;236;255m");
    expect(drawn).not.toMatch(/╱|▏/u);
  });

  it("redraws a STADIUM as a pill of the fill on the rounded slab's own footprint, an edge's stroke in its hole", () => {
    const rows = slab("flowchart LR\n    R(Round) --> A([Stadium])").split("\n");
    expect(rows[0]).toMatch(/^ ▄+\s+▂▄+▂$/u);
    expect(rows[1]).toMatch(/^▐\s+▌\s+▟\s+▙$/u);
    expect(rows[2]).toMatch(/^▐\s+Round\s+─+⏵▐\s+Stadium\s+▌$/u);
    expect(rows[3]).toMatch(/^▐\s+▌\s+▜\s+▛$/u);
    expect(rows[4]).toMatch(/^ ▀+\s+▀+$/u);
    const wall = rows[2].lastIndexOf("▐");
    expect(rows[1].lastIndexOf("▟")).toBe(wall + 1);
    expect(rows[0].indexOf("▂")).toBe(wall + 2);
    const plain = render("flowchart LR\n    R(Round) --> A([Stadium])", { width: 80 }).split("\n")[2];
    expect(wall).toBe(plain.indexOf("("));
    expect(rows[2].indexOf("▌")).toBe(plain.indexOf(")"));
    expect(rows.join("\n")).not.toMatch(/[()╭╮╰╯█]/u);
    const down = slab("flowchart TD\n    A([Stadium]) --> B([Next])").split("\n");
    expect(down[4]).toMatch(/^\s*▀+│▀+$/u);
    const drawn = renderThemed("flowchart LR\n    A([Pill])", { width: 80, borders: "borderless", background: "light" }, "default");
    expect(drawn).toContain("38;2;236;236;255m▟");
    expect(drawn).toContain("38;2;236;236;255m▂");
  });

  it("draws an ASYMMETRIC node as its fill alone, the notch in triangles and a Powerline point, no ring around it", () => {
    const rows = slab("flowchart LR\n    A>Asymmetric] --> B[Box]").split("\n");
    expect(rows[1]).toMatch(/^◥\s+▐\s+▌$/u);
    expect(rows[2]).toMatch(/^ \ue0b0\s+Asymmetric\s+─+⏵▐\s+Box\s+▌$/u);
    expect(rows[3]).toMatch(/^◢\s+▐\s+▌$/u);
    expect(rows[0]).toMatch(/^\s+▗▄+▖$/u);
    expect(rows[4]).toMatch(/^\s+▝▀+▘$/u);
    const drawn = renderThemed("flowchart LR\n    A>Flag]", { width: 80, borders: "borderless", background: "light" }, "default");
    expect(drawn).toContain("38;2;236;236;255m◥");
    expect(drawn).toContain("38;2;236;236;255m◢");
    expect(drawn).toContain("38;2;255;255;255;48;2;236;236;255m\ue0b0");
  });

  it("drops the corners of a ROUNDED box instead of filling them", () => {
    const drawn = slab("flowchart LR\n    A(Round)");
    expect(drawn).not.toContain("▗");
    expect(drawn.split("\n")[0]).toMatch(/^ ▄+$/u);
  });

  it("keeps a border the author asked for, by stroke, dasharray or width", () => {
    for (const style of ["stroke:#f00", "stroke-dasharray:5 5", "stroke-width:4px"]) {
      const drawn = slab(`flowchart LR\n    A[Kept] --> B[Slab]\n    style A ${style}`);
      expect(drawn).toMatch(/[┌┏]/u);
      expect(drawn).toContain("▗");
    }
  });

  it("paints the stroke in a hole with the EDGE's own colour", () => {
    const drawn = renderThemed(
      "flowchart TD\n    B{Gate} -->|ok| C[Go]\n    B -->|ko| D[Stop]\n    linkStyle 0 stroke:#22c55e",
      { width: 80, borders: "borderless", background: "light" },
      "default"
    );
    const bottom = must(drawn.split("\n").find((row) => row.includes("▀") && row.includes("│")));
    expect(bottom).toContain("38;2;34;197;94m│");
  });

  it("leaves the band of a divided process on the slab's edge, a stub pointing IN being no edge", () => {
    const drawn = slab('flowchart TD\n    A@{ shape: div-rect, label: "Divided" }');
    expect(drawn).toMatch(/▐─+▌/u);
  });

  it("slabs a subgraph on the page and keeps the frame of a NESTED one", () => {
    const drawn = slab("flowchart LR\n    subgraph S\n      subgraph T\n        D[Deep]\n      end\n    end");
    expect(drawn).toContain("▗");
    expect((drawn.match(/┌/gu) ?? []).length).toBe(1);
  });

  it("slabs a sequence participant's box and leaves the figure of an actor alone", () => {
    const drawn = slab("sequenceDiagram\n    participant A as Alice\n    actor B as Bob\n    A->>B: hi");
    expect(drawn).toMatch(/▐\s+Alice\s+▌/u);
    expect(drawn).toContain("─┼─");
  });

  it("keeps a `box`'s ground under the corners it cuts off a slab, never a hole of page", () => {
    const boxed = "sequenceDiagram\n    box rgb(94,85,140) Business\n    participant Client\n    participant PO\n    end\n    Client->>PO: hi";
    const rows = renderThemed(boxed, { width: 80, borders: "borderless", background: "light" }, "default").split("\n");
    const lid = rows[1];
    expect(lid).toContain("▄");
    expect(lid).not.toMatch(/\u001b\[0m \u001b/u);
    expect(rows[3]).not.toMatch(/\u001b\[0m \u001b/u);
    expect(lid).toMatch(/48;2;94;85;140m║\u001b\[0m\u001b\[48;2;94;85;140m {2}\u001b\[0m\u001b\[38;2;236;236;255;48;2;94;85;140m▄/u);
  });

  it("cuts the corners off a participant's slab, a participant's box being ROUNDED", () => {
    const rows = slab("sequenceDiagram\n    participant A as Alice\n    A->>A: hi").split("\n");
    expect(rows[0]).toMatch(/^\s+▄+$/u);
    expect(rows[0]).not.toContain("▗");
    expect(rows[2]).toMatch(/^\s+▀+$/u);
  });

  it("makes a note its lines alone, the frame's two rows given back, on a theme filling nothing as well", () => {
    const source = "sequenceDiagram\n    A->>B: hi\n    Note over A,B: Both agree\n    B-->>A: yo";
    const framed = render(source, { width: 80 }).split("\n");
    const lines = slab(source).split("\n");
    expect(lines.length).toBe(framed.length - 2);
    expect(lines.join("\n")).not.toContain("┌");
    expect(lines.join("\n")).toContain("Both agree");
    const onNeon = stripSgr(renderThemed(source, { width: 80, borders: "borderless" }, "neon"));
    expect(onNeon.split("\n").length).toBe(framed.length - 2);
    expect(onNeon).not.toContain("┌");
    expect(onNeon).toContain("╭");
  });

  it("draws NO slab where there is no fill to be the edge of: a theme filling nothing keeps every contour", () => {
    const neon = (source: string): string => stripSgr(renderThemed(source, { width: 80, borders: "borderless" }, "neon"));
    const plain = (source: string): string => stripSgr(renderThemed(source, { width: 80 }, "neon"));
    for (const source of [
      "flowchart LR\n    A[Left] --> B[Right]",
      "flowchart TD\n    A[Start] --> B{Decision}\n    B -->|Yes| C[Process]\n    B -->|No| D[End]",
      "flowchart LR\n    subgraph S\n      D[Deep]\n    end",
      "sequenceDiagram\n    participant A as Alice\n    link A: Dash @ https://x.example\n    A->>B: hi",
    ]) {
      expect(neon(source)).toBe(plain(source));
      expect(neon(source)).not.toMatch(/[▗▖▝▘▐▌▄▀]/u);
    }
    expect(render("flowchart LR\n    A[Left] --> B[Right]", { width: 80, borders: "borderless" })).toBe(
      render("flowchart LR\n    A[Left] --> B[Right]", { width: 80 })
    );
    expect(stripSgr(renderThemed("flowchart LR\n    A[Left] --> B[Right]", { width: 80, borders: "borderless" }, "dracula"))).toContain("▗");
  });

  it("draws a node filled by its style with no stroke as its fill alone, no wall round it", () => {
    const source = "flowchart LR\n    A[Build]:::solid --> B{Gate}\n    classDef solid fill:#22c55e";
    const slabbed = renderThemed(source, { width: 80, borders: "borderless", background: "light" }, "default");
    const buildRow = (drawn: string): string => (must(stripSgr(drawn).split("\n").find((row) => row.includes("Build")))).split("⏵")[0];
    expect(buildRow(slabbed)).toMatch(/^\s+Build\s+─+$/u);
    expect(stripSgr(slabbed)).toMatch(/Build\s+─+⏵▐/u);
    expect(stripSgr(slabbed)).not.toMatch(/▐\s+Build/u);
  });

  it("makes a link menu a whole slab, its rule kept a cell short of either wall", () => {
    const drawn = slab("sequenceDiagram\n    participant A as Alice\n    link A: Dash @ https://x.example\n    A->>B: hi");
    expect(drawn).not.toContain("├");
    expect(drawn).not.toContain("┤");
    expect(drawn).toMatch(/\s─{5,}\s/u);
  });
});
