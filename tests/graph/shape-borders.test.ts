import { describe, it, expect } from "vitest";
import { render, renderThemed } from "../../src/index.js";
import { must } from "../../src/must.js";

describe("a dashed box closed on PLAIN corners, heavy or light, the braille dots retired", () => {
  const DOTS = ["\u2880", "\u2840", "\u2818", "\u2803"];
  const box = (style: string, options = {}): string[] =>
    render(`flowchart TD\n    A[Comment]\n    style A ${style}\n`, { width: 60, ...options }).split("\n");

  it("closes a heavy dashed box on its four heavy corners", () => {
    const rows = box("stroke-dasharray:4,stroke-width:4px");
    expect(rows[0]).toStartWith("┏");
    expect(rows[0]).toEndWith("┓");
    expect(rows[4]).toStartWith("┗");
    expect(rows[4]).toEndWith("┛");
    for (const dot of DOTS) expect(rows.join("\n")).not.toContain(dot);
  });

  it("closes a light dashed box on its four light corners", () => {
    const drawn = box("stroke-dasharray:4").join("\n");
    expect(drawn).toContain("┌");
    expect(drawn).toContain("┘");
    for (const dot of DOTS) expect(drawn).not.toContain(dot);
  });

  it("draws a HALF line the same way up under BT and RL: the border is drawn where the box stands, never mirrored", () => {
    const bt = render(
      "flowchart BT\n    A[Comment] --> B[suite]\n    style A stroke-dasharray:5,stroke-width:4px\n",
      { width: 60 }
    );
    expect(bt).toContain("\u2579  Comment  \u2579");
    expect(bt).not.toContain("\u257b");
    const rl = render("flowchart RL\n    A[Comment] --> B[suite]\n    style A stroke-dasharray:4\n", { width: 60 });
    expect(rl).toContain("┌\u2574\u2574");
    expect(rl).not.toContain("\u2576");
  });
});

describe("a FILLED shape's name laid over its fill, which two shapes dropped on the floor", () => {
  const FILL = "48;2;255;0;0";
  const painted = (written: string): string =>
    renderThemed(`flowchart TD\n    a${written}\n    style a fill:#f00,color:#fff\n`, { width: 40 }, "classic");

  it.each([
    ["a subroutine", "[[Rempli]]"],
    ["a circle", "((Rempli))"],
    ["a double circle", "(((Rempli)))"],
    ["a rounded box", "(Rempli)"],
  ])("keeps the fill behind %s's name", (_shape, written) => {
    const drawn = painted(written);
    const name = must(drawn.split("\n").find((row) => row.includes("R")));
    for (const run of name.matchAll(/\u001b\[([0-9;:]*)m[Rempli]/gu)) expect(run[1]).toContain(FILL);
  });
});

describe("the minimum vital of a box, not floored at three cells whatever the label", () => {
  const chain = "flowchart\n    A --> B\n    B --- C\n    C -.-> D\n    D ==> E\n";
  const rows = (drawn: string): number => drawn.split("\n").length;
  const cols = (drawn: string): number => Math.max(...drawn.split("\n").map((row) => [...row].length));

  it("hugs a one-character label at the tightest padding", () => {
    const drawn = render("flowchart LR\n    A[a] --> B[b]\n", { paddingX: 0, gap: 1 });
    expect(drawn).toContain("│a├");
    expect(drawn).not.toContain("│ a ");
  });

  it("keeps the padding it was given wherever the caller gave one", () => {
    expect(render("flowchart LR\n    A[a] --> B[b]\n")).toMatch(/│  a  ├/u);
    expect(render("flowchart LR\n    A[a] --> B[b]\n")).toMatch(/│  b  │/u);
  });

  it("draws the chain across where a three-cell floor could not", () => {
    const drawn = render(chain, { width: 22 });
    expect(rows(drawn)).toBeLessThan(10);
    expect(cols(drawn)).toBeLessThanOrEqual(22);
    for (const name of ["A", "B", "C", "D", "E"]) expect(drawn).toMatch(new RegExp(`[│├┤┝┥]${name}[│├┤┝┥]`, "u"));
  });

  it("spends the room it is given rather than the floor, where the budget allows", () => {
    const tight = render(chain, { width: 22 });
    const roomier = render(chain, { width: 30 });
    expect(cols(roomier)).toBeGreaterThan(cols(tight));
    expect(rows(roomier)).toBe(rows(tight));
  });

  it("gives the HEXAGON the two cells its frame needs, alone among the shapes", () => {
    const lines = render("flowchart LR\n    A[a] --> B{{b}}\n", { paddingX: 0, gap: 1 }).split("\n");
    const opens = lines.filter((line) => /\u2571[^\u2571\u2572]*\u2572/u.test(line));
    const closes = lines.filter((line) => /\u2572[^\u2571\u2572]*\u2571/u.test(line));
    expect(opens).toHaveLength(1);
    expect(closes).toHaveLength(1);
    expect(lines.indexOf(opens[0])).toBeLessThan(lines.indexOf(closes[0]));
    expect(lines[0]).toContain("\u2581");
    expect(lines.at(-1)).toContain("\u2594");
  });

  it("closes every shape's frame at the tightest padding, none of them left half drawn", () => {
    const shapes = "flowchart LR\n" + [
      "A[a] --> B(b)", "B --> C([c])", "C --> D[[d]]", "D --> E[(e)]", "E --> F((f))",
      "F --> G>g]", "G --> H{h}", "H --> I{{i}}", "I --> J[/j/]", "J --> K[\\k\\]", "K --> L[/l\\]",
    ].map((line) => "    " + line).join("\n");
    const drawn = render(shapes, { paddingX: 0, gap: 1 });
    const lines = drawn.split("\n");
    const top = lines[0];
    const bottom = must(lines.at(-1));
    expect((top.match(/\//gu) ?? []).length).toBe((bottom.match(/\//gu) ?? []).length);
    expect((top.match(/\\/gu) ?? []).length).toBe((bottom.match(/\\/gu) ?? []).length);
    for (const label of ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"]) {
      expect(drawn).toContain(label);
    }
  });
});

describe("a css border drawn with the box glyphs Unicode has: dashed for a dasharray, heavy from 2px of width, gone at 0", () => {
  const DASHED = `graph LR
    A[Ghost]:::g --> B[Plain]
    classDef g stroke-dasharray: 5 5`;

  it("draws a dasharray border with real dashes and solid corners, visible in the plain text render", () => {
    const drawn = render(DASHED, { width: 80 });
    expect(drawn).toContain("┌─ ─");
    expect(drawn).toContain("\u2575  Ghost  ├");
    expect(drawn).not.toContain("┌─────────┐\n│  Ghost");
  });

  it("draws a stroke-width of 3px or more heavy, and the tee an edge leaves becomes its mixed kin", () => {
    const drawn = render(
      `graph LR
    A[Loud]:::t --> B[Plain]
    classDef t stroke-width:4px`,
      { width: 80 }
    );
    expect(drawn).toContain("┏━");
    expect(drawn).toContain("┃  Loud  ┠");
    expect(drawn).toContain("┛");
  });

  it("keeps a width of 1px light, draws 2px heavy, and draws NO ring at all for 0", () => {
    const soft = render("graph LR\n    A[Soft]:::t --> B[Plain]\n    classDef t stroke-width:1px", { width: 80 });
    expect(soft).toContain("│  Soft  ├");
    expect(soft).not.toContain("┃");
    const loud = render("graph LR\n    A[Loud]:::t --> B[Plain]\n    classDef t stroke-width:2px", { width: 80 });
    expect(loud).toContain("┃  Loud  ┠");
    const naked = render("graph LR\n    A[Naked]:::t --> B[Plain]\n    classDef t stroke-width:0,fill:#f9f", { width: 80 });
    expect(naked).toMatch(/^\s+Naked\s+─+⏵│/mu);
    expect(naked).not.toMatch(/┌─+┐\n\s*│\s+│\n\s*│\s+Naked/u);
  });

  it("combines the two into the heavy dashed glyphs", () => {
    const drawn = render(
      `graph LR
    A[Both]:::b --> B[Plain]
    classDef b stroke-width:3px,stroke-dasharray: 3 3`,
      { width: 80 }
    );
    expect(drawn).toContain("┏\u254d");
    expect(drawn).toContain("\u2507  Both  ┠");
  });

  it("leaves a rounded shape alone, its arc having no dashed or heavy kin", () => {
    const drawn = render(
      `graph LR
    A(Round):::g --> B[Plain]
    classDef g stroke-dasharray: 5 5`,
      { width: 80 }
    );
    expect(drawn).toContain("╭");
    expect(drawn).not.toContain("┄");
  });

  it("survives the flip a BT graph takes: the heavy corners mirror with the drawing", () => {
    const drawn = render(
      `graph BT
    A[Top]:::t --> B[Mid]:::t
    classDef t stroke-width:4px`,
      { width: 80 }
    );
    expect(drawn).toContain("┏━━━┷━━━┓");
    expect(drawn).not.toContain("┯");
  });

  it("keeps the border of a filled node whose style names dashes, where naming nothing melts it", () => {
    const kept = renderThemed(
      `graph LR
    A[Ghost]:::g --> B[Plain]
    classDef g fill:#3b82f6,stroke-dasharray: 5 5`,
      { width: 80 },
      "neon"
    );
    expect(kept).toContain("\u2575");
  });
});

describe("a composite state framed as mermaid frames one", () => {
  const drawn = render(
    "stateDiagram-v2\n    direction LR\n    [*] --> First\n    state First {\n        [*] --> second\n        second --> [*]\n    }\n",
    { width: 80 }
  );

  it("rounds the frame, centres the name on a band ruled off from the body, and doubles the floor", () => {
    expect(drawn).toMatch(/╭─+╮\n\s*│\s+First\s+│\n\s*├─+┤\n/u);
    expect(drawn).toMatch(/╘═+╛/u);
    const band = must(drawn.split("\n").find((row) => row.includes("First")));
    const left = band.indexOf("First") - band.indexOf("│") - 1;
    const right = band.lastIndexOf("│") - (band.indexOf("First") + "First".length);
    expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
  });

  it("closes that frame on its own cells in padless, keeping the rule under the name and the doubled floor", () => {
    const tight = render(
      "stateDiagram-v2\n    direction LR\n    [*] --> First\n    state First {\n        [*] --> second\n        second --> [*]\n    }\n",
      { width: 80, borders: "padless" }
    );
    const rows = tight.split("\n");
    const band = rows.findIndex((row) => row.includes("First"));
    // The lid, the band ruled off under the name, and the floor the composite doubles, in the padless alphabet.
    // The rule under the name is an eighth on the edge of its cell like the rest of the frame, never a centred `─`,
    // and the name stands on the row the lid opens on, no row bought above it. The wall is inked on the OUTER edge
    // of its own cell in this form, so the rule reaches the cell beside it and still keeps a cell of air off the line.
    expect(must(rows[band - 1])).toMatch(/^\s*\u2581+$/u);
    expect(must(rows[band + 1])).toMatch(/\u258F\u2581+\u2595$/u);
    expect(must(rows.at(-1))).toMatch(/^\s*\u2580+$/u);
    expect(tight).not.toMatch(/[\u256D\u256E\u2558\u255B\u2502]/u);
  });

  it("leaves a flowchart subgraph its plain box, the name centred under its lid", () => {
    const flow = render("flowchart LR\n    subgraph First\n        second\n    end", { width: 80 });
    expect(flow).toMatch(/┌─+┐\n\s*│\s+First\s+│/u);
    expect(flow).not.toContain("╘");
  });
});
