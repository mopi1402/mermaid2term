import { describe, expect, it } from "vitest";
import { renderThemedText } from "../../src/index.js";
import { getTheme } from "../../src/paint/catalogue.js";
import { must } from "../../src/must.js";

// Each ink read off mermaid 12's own stylesheets for the graph kinds (dist `styles` of flowchart, class, state, ER and
// block, checked on 2026-09-30): heads on `.marker`'s `lineColor`, `transitionColor` on a state's, never
// `arrowheadColor`; a note's frame on `noteBorderColor`; an edge's label on the node words' ink; the title on
// `textColor`; a composite's frame on `stateBorder || nodeBorder`.
interface Cell {
  readonly ch: string;
  readonly style: string;
  readonly owner?: string;
}

const drawn = (source: string, theme = "default"): ReadonlyArray<readonly Cell[]> => renderThemedText(source, { width: 100, background: "light" }, theme).rows;

// The colour a style inks its glyph with, the ground's left out.
const inkOf = (style: string | undefined): string | undefined => {
  const words = (style ?? "").split(/\s+/u);
  return words.find((word, at) => /^#[0-9a-f]{6}$/iu.test(word) && words[at - 1] !== "on")?.toLowerCase();
};
const groundOf = (style: string | undefined): string | undefined => {
  const words = (style ?? "").split(/\s+/u);
  const on = words.indexOf("on");
  return on === -1 ? undefined : words[on + 1]?.toLowerCase();
};

const wordCell = (rows: ReadonlyArray<readonly Cell[]>, word: string): Cell => {
  for (const row of rows) {
    const at = row.map((cell) => cell.ch).join("").indexOf(word);
    if (at !== -1) return must(row[at]);
  }
  throw new Error(`${word} is not drawn`);
};
const ownedBy = (rows: ReadonlyArray<readonly Cell[]>, owner: (key: string) => boolean): Cell[] =>
  rows.flat().filter((cell) => cell.ch !== " " && owner(cell.owner ?? ""));
const keyed = (key: string) => (owner: string): boolean => owner === key || owner.startsWith(`${key}@`);

const framed = (variables: Record<string, string>, body: string, title?: string): string =>
  ["---", ...(title === undefined ? [] : [`title: ${title}`]), "config:", "  themeVariables:",
    ...Object.entries(variables).map(([name, value]) => `    ${name}: "${value}"`), "---", body].join("\n");

const FLOWCHART = (direction: string): string => `flowchart ${direction}\n  A -->|hop| B`;
const STATE = (direction: string): string => `stateDiagram-v2\n  direction ${direction}\n  A --> B : hop`;
const CLASS = (direction: string): string => `classDiagram\n  direction ${direction}\n  Order "1" --> "many" Item : hop`;
const ER = (direction: string): string => `erDiagram\n  direction ${direction}\n  MEMBER ||--o{ LOAN : hop`;

describe.each(["TD", "LR"])("graph heads follow mermaid's `.marker`, never `arrowheadColor` (%s)", (direction) => {
  const across = direction === "TD" ? "TB" : "LR";
  const cases: ReadonlyArray<readonly [string, string]> = [
    ["flowchart", FLOWCHART(direction)],
    ["class", CLASS(across)],
    ["ER", ER(across)],
  ];
  for (const [kind, body] of cases) {
    it(`a ${kind} head wears forest's lineColor, not its green arrowheadColor`, () => {
      const heads = ownedBy(drawn(body, "forest"), keyed("arrow"));
      expect(heads.length).toBeGreaterThan(0);
      expect(new Set(heads.map((cell) => inkOf(cell.style)))).toEqual(new Set([must(getTheme("forest").variables.lineColor).toLowerCase()]));
    });

    it(`a ${kind} head takes a written lineColor, a written arrowheadColor reaching none`, () => {
      const heads = ownedBy(drawn(framed({ lineColor: "#aa0000", arrowheadColor: "#0000aa" }, body)), keyed("arrow"));
      expect(heads.length).toBeGreaterThan(0);
      expect(new Set(heads.map((cell) => inkOf(cell.style)))).toEqual(new Set(["#aa0000"]));
    });
  }

  it("a state head wears transitionColor", () => {
    const heads = ownedBy(drawn(framed({ lineColor: "#0000aa", transitionColor: "#aa0000", arrowheadColor: "#00aa00" }, STATE(across))), keyed("arrow"));
    expect(heads.length).toBeGreaterThan(0);
    expect(new Set(heads.map((cell) => inkOf(cell.style)))).toEqual(new Set(["#aa0000"]));
  });

  it("a themeCSS `.marker` still inks a flowchart's heads over the line", () => {
    const source = `---\nconfig:\n  themeCSS: ".marker { fill: #aa0000; }"\n---\n${FLOWCHART(direction)}`;
    const heads = ownedBy(drawn(source), keyed("arrow"));
    expect(new Set(heads.map((cell) => inkOf(cell.style)))).toEqual(new Set(["#aa0000"]));
  });
});

describe.each(["TD", "LR"])("an edge's label is inked as its kind's stylesheet inks it (%s)", (direction) => {
  const across = direction === "TD" ? "TB" : "LR";
  const inks = { textColor: "#223344", nodeTextColor: "#990000", classText: "#006600", transitionLabelColor: "#660066", m2t_edgeLabelColor: "#0000aa" };
  const cases: ReadonlyArray<readonly [string, string, string]> = [
    ["flowchart", FLOWCHART(direction), "#990000"],
    ["ER", ER(across), "#990000"],
    ["class", CLASS(across), "#006600"],
    ["state", STATE(across), "#660066"],
  ];
  for (const [kind, body, ink] of cases) {
    it(`a ${kind} label wears ${ink}, never the house edge ink`, () => {
      expect(inkOf(wordCell(drawn(framed(inks, body)), "hop").style)).toBe(ink);
    });
  }

  it("a class relation's multiplicities wear classText", () => {
    const rows = drawn(framed(inks, CLASS(across)));
    expect(inkOf(wordCell(rows, "many").style)).toBe("#006600");
  });

  it("a house theme's own edge ink reaches no flowchart label", () => {
    const terra = getTheme("terra").variables;
    expect(inkOf(wordCell(drawn(FLOWCHART(direction), "terra"), "hop").style)).not.toBe(must(terra.m2t_edgeLabelColor).toLowerCase());
  });
});

describe("a block link's label wears nodeTextColor, as mermaid's `.label`", () => {
  it.each([1, 3])("with %i column(s)", (columns) => {
    const body = `block-beta\n  columns ${columns}\n  A space B\n  A -- "hop" --> B`;
    expect(inkOf(wordCell(drawn(framed({ nodeTextColor: "#990000", m2t_edgeLabelColor: "#0000aa" }, body)), "hop").style)).toBe("#990000");
  });
});

describe.each(["TD", "LR"])("the title wears textColor, whatever the node words wear (%s)", (direction) => {
  const across = direction === "TD" ? "TB" : "LR";
  const inks = { textColor: "#223344", nodeTextColor: "#990000", classText: "#006600", stateLabelColor: "#660066" };
  const cases: ReadonlyArray<readonly [string, string]> = [
    ["flowchart", FLOWCHART(direction)],
    ["ER", ER(across)],
    ["class", CLASS(across)],
    ["state", STATE(across)],
    ["block", `block-beta\n  columns ${direction === "TD" ? 1 : 3}\n  A B`],
  ];
  for (const [kind, body] of cases) {
    it(`a ${kind} title`, () => {
      expect(inkOf(wordCell(drawn(framed(inks, body, "Heading")), "Heading").style)).toBe("#223344");
    });
  }
});

describe.each(["TB", "LR"])("a note's frame wears noteBorderColor (%s)", (direction) => {
  const rim = (rows: ReadonlyArray<readonly Cell[]>): Set<string | undefined> => new Set(ownedBy(rows, (owner) => /^note(@rim)?(@bg:#[0-9A-F]{6})?$/iu.test(owner)).map((cell) => inkOf(cell.style)));
  it("on a state diagram", () => {
    expect(rim(drawn(framed({ noteBorderColor: "#aa0000" }, `stateDiagram-v2\n  direction ${direction}\n  A --> B\n  note right of A : memo`)))).toEqual(new Set(["#aa0000"]));
  });
  it("on a class diagram", () => {
    expect(rim(drawn(framed({ noteBorderColor: "#aa0000" }, `classDiagram\n  direction ${direction}\n  class A\n  note for A "memo"`)))).toEqual(new Set(["#aa0000"]));
  });
  it("on a sequence diagram", () => {
    expect(rim(drawn(framed({ noteBorderColor: "#aa0000" }, "sequenceDiagram\n  A->>B: hi\n  Note right of B: memo")))).toEqual(new Set(["#aa0000"]));
  });
  it("the theme's own, when none is written", () => {
    const own = must(getTheme("default").variables.noteBorderColor).toLowerCase();
    expect(rim(drawn(`stateDiagram-v2\n  direction ${direction}\n  A --> B\n  note right of A : memo`))).toEqual(new Set([own]));
  });
});

describe.each(["TB", "LR"])("a composite state's frame wears stateBorder, compositeBorder read by no sheet (%s)", (direction) => {
  it("stateBorder written, compositeBorder written apart", () => {
    const body = `stateDiagram-v2\n  direction ${direction}\n  state Outer {\n    A --> B\n  }`;
    const frame = ownedBy(drawn(framed({ stateBorder: "#aa0000", compositeBorder: "#00aa00" }, body)), keyed("subgraph_composite"));
    expect(frame.length).toBeGreaterThan(0);
    expect(new Set(frame.map((cell) => inkOf(cell.style)))).toEqual(new Set(["#aa0000"]));
  });
});

describe.each(["TD", "LR"])("an edge label inside a filled subgraph keeps edgeLabelBackground (%s)", (direction) => {
  it("under a `style` fill", () => {
    const body = `flowchart ${direction}\n  subgraph S [Cluster]\n    A -->|hop| B\n  end\n  style S fill:#0000ff`;
    const ground = must(getTheme("default").variables.edgeLabelBackground).toLowerCase();
    const rows = drawn(body);
    const row = must(rows.find((cells) => cells.map((cell) => cell.ch).join("").includes("hop")));
    const at = row.map((cell) => cell.ch).join("").indexOf("hop");
    expect(row.slice(at, at + 3).map((cell) => groundOf(cell.style))).toEqual([ground, ground, ground]);
  });
});

describe.each(["TD", "LR"])("a linkStyle's stroke reaches neither the label nor its ground (%s)", (direction) => {
  const ground = must(getTheme("default").variables.edgeLabelBackground).toLowerCase();
  it("stroke alone: the label keeps the plain chip", () => {
    const plain = wordCell(drawn(`flowchart ${direction}\n  A -->|hop| B`), "hop");
    const cell = wordCell(drawn(`flowchart ${direction}\n  A -->|hop| B\n  linkStyle 0 stroke:#ff0000`), "hop");
    expect(cell.style).toBe(plain.style);
    expect(groundOf(cell.style)).toBe(ground);
  });
  it("stroke and color: the label takes the color on edgeLabelBackground", () => {
    const cell = wordCell(drawn(`flowchart ${direction}\n  A -->|hop| B\n  linkStyle 0 stroke:#ff0000,color:#990000`), "hop");
    expect(inkOf(cell.style)).toBe("#990000");
    expect(groundOf(cell.style)).toBe(ground);
  });
});

describe.each(["TB", "LR"])("a class relation's label ground follows the look (%s)", (direction) => {
  const body = (look: string): string => `---\nconfig:\n  look: ${look}\n---\nclassDiagram\n  direction ${direction}\n  Order --> Item : hop`;
  const v = getTheme("default").variables;
  it("classic: mainBkg, as `.edgeLabel .label span`", () => {
    expect(groundOf(wordCell(drawn(body("classic")), "hop").style)).toBe(must(v.mainBkg).toLowerCase());
  });
  it("neo: edgeLabelBackground, as `.edgeLabel[data-look=\"neo\"]`", () => {
    expect(groundOf(wordCell(drawn(body("neo")), "hop").style)).toBe(must(v.edgeLabelBackground).toLowerCase());
  });
});
