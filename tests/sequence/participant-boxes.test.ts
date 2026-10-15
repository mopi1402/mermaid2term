import { describe, it, expect } from "vitest";
import { render, renderThemed } from "../../src/index.js";
import { parseSequenceDiagram } from "../../src/diagrams/sequence/parser.js";

describe("a `box` around participants, drawn as the DOUBLE rule", () => {
  const source =
    "sequenceDiagram\n    box Purple Alice & John\n    participant A\n    participant J\n    end\n" +
    "    box Another Group\n    participant B\n    participant C\n    end\n" +
    "    A->>J: hello\n    A->>B: across\n";

  it("frames the group from the first row to the last, its title on the top rule", () => {
    const rows = render(source, { width: 100 }).split("\n");
    expect(rows[0]).toContain("╔");
    expect(rows[0]).toContain(" Alice & John ");
    expect(rows[0]).toContain(" Another Group ");
    expect(rows[rows.length - 1]).toMatch(/╚═+╝/u);
    for (const row of rows.slice(1, -1)) expect(row).toContain("║");
  });

  it("writes the title ON the rule and not through it, blanks and all", () => {
    expect(render(source, { width: 100 })).not.toContain("Alice═&═John");
  });

  it("runs a message through both walls it crosses, each wall cut under it", () => {
    const rows = render(source, { width: 100 }).split("\n");
    const across = rows.findIndex((row) => row.includes("across"));
    expect(rows[across + 1]).toMatch(/^║\s+─+⏵\s+│\s+║$/u);
  });

  it("reads the COLOUR off the line where CSS names one, and leaves the title whole where it does not", () => {
    const boxes = parseSequenceDiagram(source).boxes;
    expect(boxes.map((box) => [box.colour, box.title])).toEqual([
      ["Purple", "Alice & John"],
      [undefined, "Another Group"],
    ]);
    expect(boxes.map((box) => box.participants)).toEqual([
      ["A", "J"],
      ["B", "C"],
    ]);
  });

  it("reads a colour written as a VALUE, brackets and blanks included", () => {
    const written = ["rgb(33,66,99)", "rgba(33, 66, 99, 0.5)", "hsl(10, 40%, 90%)", "#f0f"];
    for (const colour of written) {
      const box = parseSequenceDiagram(`sequenceDiagram\n    box ${colour} Users\n    participant A\n    end\n`)
        .boxes[0];
      expect([box?.colour, box?.title]).toEqual([colour, "Users"]);
    }
  });

  it("keeps an unbroken top rule where the line names no title", () => {
    const rows = render("sequenceDiagram\n    box Purple\n    participant A\n    end\n    A->>A: hm\n", {
      width: 60,
    }).split("\n");
    expect(rows[0]).toMatch(/^╔═+╗/u);
  });

  it("stands a participant that is in NO box outside the frame, and never flush against its wall", () => {
    const rows = render(
      "sequenceDiagram\n    box Pair\n    participant A\n    participant B\n    end\n    participant Z\n    A->>Z: out\n",
      { width: 90 }
    ).split("\n");
    const header = rows[1];
    expect(header).toMatch(/║\s╭/u);
    expect(header).not.toMatch(/║╭/u);
  });

  it("lets a NOTE pass in front of a wall, a post-it keeping its own border", () => {
    const rows = render(
      "sequenceDiagram\n    box Pair\n    participant A\n    participant B\n    end\n    participant Z\n" +
        "    Note over B,Z: across the wall\n    B->>Z: out\n",
      { width: 90 }
    ).split("\n");
    const note = rows.findIndex((row) => row.includes("across the wall"));
    expect(note).toBeGreaterThan(0);
    for (const row of rows.slice(note - 1, note + 2)) expect(row).not.toContain("╫");
  });
});

describe("a `box` painted with the FILL its author named, where nothing was painted and no colour was even read", () => {
  const PURPLE = "48;2;128;0;128";
  const source =
    "sequenceDiagram\n    box Purple Alice & John\n    participant A\n    participant J\n    end\n" +
    "    box Another Group\n    participant B\n    participant C\n    end\n" +
    "    A->>J: hello\n    A->>B: across\n";

  it("lays the fill under every cell the frame covers, its rules and its title included", () => {
    const rows = renderThemed(source, { width: 100 }, "neon").split("\n");
    for (const row of rows) expect(row).toContain(PURPLE);
    const title = rows[0];
    const painted = title.slice(0, title.indexOf("\u2557"));
    for (const run of painted.matchAll(/\u001b\[([0-9;:]*)m[Alice]/gu)) expect(run[1]).toContain(PURPLE);
  });

  it("paints nothing for a box that named no colour, the page showing through it", () => {
    const rows = renderThemed(source, { width: 100 }, "neon").split("\n");
    const tail = rows[1].slice(rows[1].lastIndexOf("Group"));
    expect(tail).not.toContain(PURPLE);
  });

  it("paints nothing at all in the drawing a terminal reads without colour", () => {
    expect(render(source, { width: 100 })).not.toContain("\u001b");
  });

  it("spends the author's own value, a name, a hex, a function or a percentage all landing on one", () => {
    const painted = (colour: string): string =>
      renderThemed(`sequenceDiagram\n    box ${colour} Users\n    participant A\n    end\n    A->>A: hm\n`, { width: 60 }, "neon");
    expect(painted("Purple")).toContain(PURPLE);
    expect(painted("#800080")).toContain(PURPLE);
    expect(painted("rgb(128, 0, 128)")).toContain(PURPLE);
    expect(painted("rgba(128, 0, 128, 0.5)")).toContain("48;2;64;0;64");
    expect(painted("transparent")).not.toContain("48;2;");
  });

  it("leaves every other family's `subgraph` cells exactly as unpainted as it found them", () => {
    const graph = renderThemed("gitGraph\n    commit\n    branch dev\n    commit\n", { width: 60 }, "neon");
    expect(graph).not.toContain("48;2;");
  });
});
