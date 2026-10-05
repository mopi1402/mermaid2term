import { describe, it, expect } from "vitest";
import { renderThemed } from "../../src/index.js";
import { must } from "../../src/must.js";
import { type Run, runsOf, stripSgr } from "../support/ansi.js";
import { ESC } from "../../src/paint/escapes.js";

describe("a node filled by its theme, the way mermaid fills one: `mainBkg` inside the box, the border left bare", () => {
  const SOURCE = "flowchart LR\n  A[Hello world] --> B{{Hexagon}}";
  const rowWith = (drawn: string, word: string): string => must(drawn.split("\n").find((r) => r.includes(word)));
  const FILL = "48;2;236;236;255";

  it("lays the fill on the interior blanks and under the label, and nothing on the frame", () => {
    const drawn = renderThemed(SOURCE, { look: "classic", background: "light" }, "default");
    const row = rowWith(drawn, "Hello");
    for (const [codes, text] of runsOf(row)) {
      if (text === "") continue;
      if (/[│├┤╱╲⟨⟩─⏵]/u.test(text)) expect(codes).not.toContain("48;2;");
      else expect(codes).toContain(FILL);
    }
    expect(row).toContain(`38;2;51;51;51;${FILL}mHello`);
    expect(drawn.split("\n")[0]).not.toContain("48;2;");
  });

  it("follows the theme's own fill on the other side: `default` on a dark ground is `dark`, filled #1F2020", () => {
    const drawn = renderThemed(SOURCE, { look: "classic", background: "dark" }, "default");
    expect(drawn).toContain("48;2;31;32;32m");
    expect(drawn).not.toContain(FILL);
  });

  it("gives way to the fill an author declares, and fills the other boxes still", () => {
    const drawn = renderThemed(`${SOURCE}\n  style A fill:#c0ffee`, { background: "light" }, "default");
    expect(rowWith(drawn, "Hello")).toContain("48;2;192;255;238");
    expect(rowWith(drawn, "Hello")).not.toContain(`${FILL}mHello`);
    expect(rowWith(drawn, "Hexagon")).toContain(FILL);
  });

  it("fills nothing under a text theme, which names no `mainBkg`", () => {
    for (const theme of ["mono", "classic", "neon"]) expect(renderThemed(SOURCE, {}, theme)).not.toContain("48;2;");
  });
});

// mermaid 12 hands a label its `linkStyle`'s text properties alone (`isLabelStyle`): a stroke stays on the line.
describe("an edge label on its chip: the theme's `edgeLabelBackground`, whatever a `linkStyle` strokes the edge with", () => {
  const SOURCE = "flowchart LR\n  A -->|yes| B\n  B -->|no| C\n  linkStyle 1 stroke:#22c55e";
  const rowWith = (drawn: string, word: string): string => must(drawn.split("\n").find((r) => r.includes(word)));

  it("lays #E8E8E8 under the word and its pad on `default`, the label's ink weighed on it", () => {
    const row = rowWith(renderThemed(SOURCE, { look: "classic", background: "light" }, "default"), "yes");
    expect(row).toContain("3;38;2;51;51;51;48;2;232;232;232myes");
    expect(row).toContain("48;2;232;232;232myes\u001b[0m ");
    expect(row).toMatch(/48;2;232;232;232m no \u001b\[0m/u);
  });

  it("lays BOTH pads or none: a word flush against its shaft, `┊async`, keeps no grey tab past its far end", () => {
    const TD = "flowchart TD\n  Order --> Stock\n  Order -.->|async| AL[Audit<br>Log]\n  Order ==>|critical| Payment\n  Stock -->|low| Restock";
    const tight = renderThemed(TD, { look: "classic", width: 40, borders: "padless", background: "light" }, "default");
    expect(rowWith(tight, "async")).toContain("┊\u001b[0m\u001b[3;38;2;51;51;51;48;2;232;232;232masync\u001b[0m ");
    expect(rowWith(tight, "async")).toMatch(/48;2;232;232;232mcritical\u001b\[0m$/u);
    expect(rowWith(tight, "low")).toMatch(/│\u001b\[0m\u001b\[[0-9;]*48;2;232;232;232mlow\u001b\[0m$/u);
    const plain = renderThemed(TD, { look: "classic", width: 40, background: "light" }, "default");
    expect(rowWith(plain, "async")).toContain("┊\u001b[0m\u001b[3;38;2;51;51;51;48;2;232;232;232masync\u001b[0m ");
    const airy = renderThemed(TD, { look: "classic", width: 80, borders: "padless", background: "light" }, "default");
    expect(rowWith(airy, "async")).toContain("48;2;232;232;232m async \u001b[0m");
    expect(rowWith(airy, "async")).toMatch(/48;2;232;232;232m critical \u001b\[0m$/u);
  });

  it("keeps the pad past a label that ENDS its row, ` No ` and not ` No`, the way the pad in front is kept", () => {
    const TD = "flowchart TD\n  A[Start] --> B{Decision}\n  B -->|Yes| C[Process]\n  B -->|No| D[End]\n  C --> D";
    const row = rowWith(renderThemed(TD, { look: "classic", background: "light" }, "default"), "No");
    expect(row).toMatch(/48;2;232;232;232m No \u001b\[0m$/u);
    expect(rowWith(renderThemed(TD, {}, "mono"), "No")).toMatch(/No\u001b\[0m$/u);
  });

  it("leaves a `linkStyle`'s stroke to the line: the word keeps the label's ink on the theme's chip", () => {
    const row = rowWith(renderThemed(SOURCE, { look: "classic", background: "light" }, "default"), "no");
    expect(row).toMatch(/3;38;2;51;51;51;48;2;232;232;232m ?no/u);
    expect(row).not.toMatch(/38;2;34;197;94[0-9;]*m ?no/u);
  });

  it("follows the twin on the other side: `dark` lays its #585858", () => {
    expect(rowWith(renderThemed(SOURCE, { look: "classic", background: "dark" }, "default"), "yes")).toContain("48;2;88;88;88myes");
  });

  it("keeps the theme's chip under a stroked `linkStyle` on the terminal's own colour too", () => {
    const drawn = renderThemed(SOURCE, { look: "classic", background: "#202030" }, "default");
    expect(rowWith(drawn, "no")).toContain("48;2;88;88;88m no");
    expect(rowWith(drawn, "yes")).toContain("48;2;88;88;88myes");
  });

  it("keeps the theme's chip under a `linkStyle` that names no colour, a dasharray alone", () => {
    const dashed = "flowchart LR\n  A -->|yes| B\n  linkStyle 0 stroke-dasharray: 5 5";
    expect(rowWith(renderThemed(dashed, { look: "classic", background: "light" }, "default"), "yes")).toContain("48;2;232;232;232m");
  });

  it("writes the word bare under a theme of this package, which names no such ground", () => {
    for (const theme of ["mono", "classic", "neon", "dracula"]) {
      expect(rowWith(renderThemed(SOURCE, {}, theme), "yes")).not.toMatch(/48;2;\d+;\d+;\d+m ?yes/u);
    }
  });
});

describe("a subgraph filled with `clusterBkg`, the way mermaid fills a cluster: the frame bare, the inside grounded", () => {
  const SOURCE = "flowchart LR\n  subgraph S\n    A --> B\n  end\n  B --> C";
  const CLUSTER = "48;2;255;255;222";
  const TOP = "┌" + "─".repeat(20) + "┐";

  it("lays #FFFFDE under the blanks inside the frame on `default`, and nothing on the frame", () => {
    const rows = renderThemed(SOURCE, { look: "classic", background: "light" }, "default").split("\n");
    const frame = must(rows.find((r) => r.includes(TOP)));
    expect(frame).not.toContain("48;2;");
    const inside = new RegExp(`│${ESC}\\[0m${ESC}\\[${CLUSTER}m {20}${ESC}\\[0m`, "u");
    expect(rows.some((r) => inside.test(r))).toBe(true);
  });

  it("draws the edge, its head and the cluster's name ON the ground, not through it", () => {
    const rows = renderThemed(SOURCE, { look: "classic", background: "light" }, "default").split("\n");
    const edge = must(rows.find((r) => r.includes("⏵")));
    expect(edge).toMatch(new RegExp(`38;2;51;51;51;${CLUSTER}m─+`, "u"));
    expect(edge).toMatch(new RegExp(`38;2;51;51;51;${CLUSTER}m⏵`, "u"));
    const name = must(rows.find((r) => r.includes("S")));
    expect(name).toMatch(new RegExp(`${CLUSTER}mS`, "u"));
    expect(rows.join("\n")).toContain("48;2;236;236;255");
  });

  it("lays the ground behind an edge cutting through a tight WALL under `padless`, the gap between two clusters alone bare", () => {
    const CHAIN = "flowchart LR\n  subgraph S1\n    A\n  end\n  subgraph S2\n    B\n  end\n  A --> B";
    const rowWith = (drawn: string, word: string): string => must(drawn.split("\n").find((r) => r.includes(word)));
    const lr = rowWith(renderThemed(CHAIN, { look: "classic", borders: "padless", background: "light" }, "default"), "A");
    expect(lr).toContain(`${CLUSTER}m───${ESC}[0m${ESC}[38;2;51;51;51m───${ESC}[0m${ESC}[38;2;51;51;51;${CLUSTER}m──${ESC}[0m${ESC}[1;38;2;51;51;51;${CLUSTER}m⏵`);
    const rl = rowWith(renderThemed(CHAIN.replace("LR", "RL"), { look: "classic", borders: "padless", background: "light" }, "default"), "A");
    expect(rl).toContain(`${CLUSTER}m⏴${ESC}[0m${ESC}[38;2;51;51;51;${CLUSTER}m──${ESC}[0m${ESC}[38;2;51;51;51m───${ESC}[0m${ESC}[38;2;51;51;51;${CLUSTER}m───${ESC}[0m`);
    const td = renderThemed(CHAIN.replace("LR", "TD"), { look: "classic", borders: "padless", background: "light" }, "default").split("\n");
    // The row the shaft has TO ITSELF, between the two frames: no frame glyph on it, so no cluster ground either.
    const gap = must(td.find((row) => stripSgr(row).trim() === "│"));
    expect(gap).not.toContain(CLUSTER);
  });

  it("lays nothing under a theme that names no cluster ground", () => {
    for (const theme of ["mono", "classic", "neon"]) expect(renderThemed(SOURCE, {}, theme)).not.toContain("48;2;");
  });
});

describe("a name hung under a mark is one chip: its pad and the gap between its words on the fill", () => {
  it("paints ` Small circle ` in one span on `base`, the blanks on the fill, and leaves it bare on a theme with no fill", () => {
    const source = "flowchart LR\n  A@{shape: sm-circ, label: Small circle} --> B@{shape: hourglass, label: Hourglass}";
    const row = must(renderThemed(source, { look: "classic", background: "light" }, "base").split("\n").find((r) => r.includes("Small")));
    expect(row).toMatch(/48;2;255;244;221m \u001b\[0m\u001b\[1;38;2;51;51;51;48;2;255;244;221mSmall\u001b\[0m\u001b\[[\d;]*48;2;255;244;221m \u001b\[0m\u001b\[1;38;2;51;51;51;48;2;255;244;221mcircle\u001b\[0m\u001b\[[\d;]*48;2;255;244;221m \u001b\[0m/u);
    expect(row).toMatch(/Hourglass\u001b\[0m\u001b\[[\d;]*48;2;255;244;221m \u001b\[0m$/u);
    const bare = must(renderThemed(source, {}, "mono").split("\n").find((r) => r.includes("Small")));
    expect(bare).not.toContain("48;2;");
  });
});

describe("a node's frame inside a cluster stands on the cluster's ground, as a drum's wall does", () => {
  const SOURCE = "flowchart TD\n  subgraph S\n    A[Alpha] --> B[Beta]\n  end";
  const CLUSTER = "48;2;255;255;222";
  const INK = "38;2;147;112;219";

  it("lays the cluster's ground behind every frame glyph, the junction an edge leaves by included", () => {
    const rows = renderThemed(SOURCE, { look: "classic", background: "light" }, "default").split("\n");
    expect(rows.filter((r) => r.includes("┌"))[1]).toContain(`${INK};${CLUSTER}m┌`);
    const junction = must(rows.find((r) => r.includes("┬")));
    expect(junction).toContain(`${INK};${CLUSTER}m└`);
    expect(junction).toMatch(new RegExp(`${INK};${CLUSTER}m[─┬└┘]*┬`, "u"));
  });

  it("keeps the theme's own stroke on the cluster's ground, never weighed against it, as mermaid strokes it", () => {
    const SAND = "38;2;238;221;187";
    const GROUND = "48;2;246;249;255";
    const rows = renderThemed("flowchart TD\n  subgraph S\n    A[Alpha]\n    B[(Drum)]\n  end", { look: "classic", background: "light" }, "base").split("\n");
    const frame = rows.filter((r) => r.includes("┌"))[1];
    expect(frame).toContain(`${SAND};${GROUND}m┌`);
    const wall = must(rows.find((r) => r.includes("⎜")));
    expect(wall).toContain(`${SAND};${GROUND}m⎜`);
    expect(rows.join("\n")).not.toContain("38;2;179;137;45");
  });

  it("lays the parent's ground behind the frame of a NESTED subgraph, its stroke kept, and leaves the outer frame bare", () => {
    const nested = "flowchart LR\n  subgraph TOP\n    subgraph B1\n      i1 --> f1\n    end\n  end";
    const rows = renderThemed(nested, { look: "classic", background: "light" }, "base").split("\n");
    const STROKE = "38;2;207;219;243";
    const GROUND = "48;2;246;249;255";
    const [outer, inner] = rows.filter((r) => r.includes("┌"));
    expect(outer).toMatch(new RegExp(`^\\s*${ESC}\\[${STROKE}m┌`, "u"));
    expect(inner).toContain(`${STROKE};${GROUND}m┌`);
    expect(rows.find((r) => r.includes("B1"))).toContain(`${STROKE};${GROUND}m│`);
  });

  it("lays `dark`'s quarter-white cluster border on what the frame stands on: the page outside, the parent's fill inside", () => {
    const nested = "flowchart LR\n  subgraph TOP\n    subgraph B1\n      i1 --> f1\n    end\n  end";
    const rows = renderThemed(nested, { look: "classic", background: "#333333" }, "dark").split("\n");
    const [outer, inner] = rows.filter((r) => r.includes("┌"));
    expect(outer).toMatch(new RegExp(`^\\s*${ESC}\\[38;2;102;102;102m┌`, "u"));
    expect(inner).toContain("38;2;117;119;119;48;2;71;73;73m┌");
    expect(rows.join("\n")).not.toContain("38;2;255;255;255");
  });

  it("fills a class box TO ITS FRAME with the theme's node fill, an author's `fill` taking its place", () => {
    const source = "classDiagram\n  class Animal {\n    +String name\n  }\n  class Dog\n  style Dog fill:#bbf,stroke:#33f";
    const rows = renderThemed(source, { look: "classic", background: "light" }, "default").split("\n");
    const member = must(rows.find((r) => r.includes("+String")));
    expect(member).toContain("48;2;236;236;255m ");
    expect(member).toContain("48;2;236;236;255m+String");
    // The wall stands ON the fill: mermaid strokes the outline over the filled rect, and a frame carrying the page
    // instead would read as a blank line cut through the box.
    expect(member).toMatch(/38;2;147;112;219;48;2;236;236;255m│/u);
    // The two names no longer share a row: `Animal` shows one compartment and `Dog` the two empty bands of a bare class.
    expect(must(rows.find((r) => r.includes("Dog")))).toMatch(/48;2;187;187;255mDog/u);
    expect(must(rows.find((r) => r.includes("Animal")))).toMatch(/48;2;236;236;255mAnimal/u);
  });

  it("leaves NO row of a class box on the page, whichever way its borders are drawn", () => {
    const source = "classDiagram\n  class Animal {\n    +String name\n    +makeSound()\n  }\n";
    for (const borders of ["default", "padless"] as const) {
      const rows = renderThemed(source, { look: "classic", width: 60, background: "light", borders }, "default")
        .split("\n")
        .filter((row) => row.trim() !== "");
      expect(rows).toHaveLength(7);
      for (const row of rows) expect(row).toContain("48;2;236;236;255");
    }
  });

  it("leaves the frame bare where the node stands on the page alone", () => {
    const rows = renderThemed("flowchart TD\n  A[Alpha] --> B[Beta]", { look: "classic", background: "light" }, "default").split("\n");
    expect(rows[0]).toMatch(new RegExp(`^${ESC}\\[${INK}m┌`, "u"));
    expect(rows[0]).not.toContain("48;2;");
  });
});

describe("a composite state, which mermaid dresses from `compositeBorder` and not from the cluster", () => {
  const SOURCE = "stateDiagram-v2\n    [*] --> First\n    state First {\n        [*] --> second\n        second --> [*]\n    }";
  // `theme-base.js`: `compositeBorder = compositeBorder || nodeBorder`, which `dark` leaves at `#CCCCCC` where its
  // `clusterBorder` is a quarter-white that came out near black on the frame and lighter on the rule inside it.
  const BORDER = "38;2;204;204;204";
  const FRAME = /[╭╮╰╯│├┤╘╛═▁▏▕▀]/u;

  const framed = (drawn: string): Run[] => runsOf(drawn).filter(([, text]) => FRAME.test(text));

  for (const borders of ["default", "padless"] as const) {
    it(`inks every cell of the frame the one colour, borders \`${borders}\``, () => {
      const drawn = renderThemed(SOURCE, { look: "classic", background: "dark", borders }, "default");
      const onFrame = framed(drawn).filter(([codes]) => codes.startsWith(BORDER));
      expect(onFrame.length).toBeGreaterThan(0);
      expect(drawn).not.toContain("38;2;64;64;64");
      expect(drawn).not.toContain("38;2;117;119;119");
    });
  }

  it("leaves a flowchart subgraph on the cluster's own border, mermaid keeping the two apart", () => {
    const rows = renderThemed("flowchart TD\n  subgraph S\n    A[a] --> B[b]\n  end", { look: "classic", background: "dark" }, "default").split("\n");
    expect(rows[0]).toMatch(new RegExp(`^${ESC}\\[38;2;64;64;64m┌`, "u"));
  });

  // A padless border inks ONE edge of its cell and leaves the rest of it to a side: the ground reaches the cells the
  // border is pushed out on and stops short of the ones it is pulled in on, so it never shows past the line.
  // The body under the divider stands on `compositeBackground`, `background` in `default`, and not on the cluster.
  const BODY = "48;2;255;255;255";
  const TITLE = "48;2;236;236;255";
  const PAIR = "stateDiagram-v2\n    [*] --> First\n    state First {\n        [*] --> second\n    }" +
    "\n    [*] --> Other\n    state Other {\n        [*] --> third\n    }";

  it("grounds the lid and the floor of a composite pulled in on its WALLS, and leaves the wall cells bare", () => {
    const rows = renderThemed(PAIR, { look: "classic", borders: "padless", background: "light", width: 80 }, "default").split("\n");
    // The lid stands in the name's band and the floor in the body, so the two rows take the two grounds; either way
    // the wall cells on both ends are bare, the ground stopping at the line and never showing past it.
    for (const [row, ground] of [[must(rows.find((r) => r.includes("▔▔▔"))), TITLE], [must(rows.find((r) => r.includes("▄▄▄"))), BODY]] as const) {
      expect(row).toMatch(new RegExp(`${ESC}\\[38;2;147;112;219m▕${ESC}\\[0m${ESC}\\[38;2;147;112;219;${ground}m[▔▄]+${ESC}\\[0m${ESC}\\[38;2;147;112;219m▏`, "u"));
    }
    const name = must(rows.find((r) => r.includes("First")));
    expect(name).toMatch(new RegExp(`${ESC}\\[38;2;147;112;219m▕${ESC}\\[0m${ESC}\\[${TITLE}m`, "u"));
    expect(name).toMatch(new RegExp(`${ESC}\\[${TITLE}m {6}${ESC}\\[0m${ESC}\\[38;2;147;112;219m▏`, "u"));
  });

  // `compositeTitleBackground = compositeTitleBackground || mainBkg` (`theme-base.js`): the band the name stands on
  // takes a BOX's own fill, where the body below the divider takes `compositeBackground`.
  it("stands the name's band on `mainBkg` down to the divider, the body below it on `compositeBackground`", () => {
    for (const borders of ["padless", "default"] as const) {
      const rows = renderThemed(PAIR, { look: "classic", borders, background: "light", width: 80 }, "default").split("\n");
      const at = rows.findIndex((r) => r.includes("First"));
      expect(rows[at]).toContain(`${TITLE}mFirst`);
      expect(rows[at]).not.toContain(BODY);
      // The divider, the row right under the name, is where mermaid's inner rect begins: it belongs to the band.
      expect(rows[at + 1]).toMatch(/[─═▁]/u);
      expect(rows[at + 1]).toContain(TITLE);
      expect(rows[at + 1]).not.toContain(BODY);
      const body = must(rows.find((r) => r.includes("second")));
      expect(body).toContain(BODY);
    }
  });

  it("leaves the band bare under a theme that names no fill of its own", () => {
    for (const theme of ["mono", "classic", "neon"]) expect(renderThemed(PAIR, { look: "classic", borders: "padless", width: 80 }, theme)).not.toContain("48;2;");
  });

  it("keeps the ground on the wall cells of a composite pushed out on them, its lid and floor rows bare", () => {
    const rows = renderThemed(SOURCE, { look: "classic", borders: "padless", background: "light" }, "default").split("\n");
    const floor = rows.findIndex((r) => r.includes("▀▀▀"));
    expect(rows[0]).not.toContain(BODY);
    expect(rows[floor]).not.toContain(BODY);
    // A wall pushed OUT stands inside the frame, so it takes the ground of the row it is on and never the page's:
    // the band's above the divider, the body's below it.
    for (const [row, ground] of [[rows[floor - 1], BODY], [must(rows.find((r) => r.includes("First"))), TITLE]] as const) {
      expect(row).toMatch(new RegExp(`${ESC}\\[38;2;147;112;219;${ground}m▏`, "u"));
      expect(row).toMatch(new RegExp(`${ESC}\\[38;2;147;112;219;${ground}m▕`, "u"));
    }
  });
});
