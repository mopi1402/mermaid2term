import { describe, it, expect } from "vitest";
import { render, renderThemedText } from "../../src/index.js";

// Every lowercase name mermaid 12's registry answers to (`generateShapeMap`), grouped by the shape it draws: the first
// name of a group is the one each other name must draw exactly like.
const FAMILIES: ReadonlyArray<readonly string[]> = [
  ["rect", "proc", "process", "rectangle"],
  ["rounded", "event"],
  ["stadium", "terminal", "pill"],
  ["subroutine", "fr-rect", "subprocess", "subproc", "framed-rectangle"],
  ["cyl", "db", "database", "cylinder", "lin-cyl", "disk", "lined-cylinder", "bucket"],
  ["h-cyl", "das", "horizontal-cylinder"],
  ["datastore", "data-store"],
  ["folder", "directory"],
  ["dbl-circ", "double-circle", "doublecircle"],
  ["sm-circ", "start", "small-circle"],
  ["framed-circle", "fr-circ", "stop"],
  ["f-circ", "junction", "filled-circle"],
  ["cross-circ", "summary", "crossed-circle"],
  ["diam", "decision", "diamond", "question"],
  ["hex", "hexagon", "prepare"],
  ["lean-r", "lean-right", "in-out"],
  ["lean-l", "lean-left", "out-in"],
  ["trap-b", "priority", "trapezoid-bottom", "trapezoid"],
  ["trap-t", "manual", "trapezoid-top", "inv-trapezoid"],
  ["tri", "extract", "triangle"],
  ["flip-tri", "manual-file", "flipped-triangle"],
  ["notch-pent", "loop-limit", "notched-pentagon"],
  ["sl-rect", "manual-input", "sloped-rectangle"],
  ["win-pane", "internal-storage", "window-pane"],
  ["st-rect", "procs", "processes", "stacked-rectangle"],
  ["tag-rect", "tagged-rectangle", "tag-proc", "tagged-process"],
  ["doc", "document"],
  ["lin-doc", "lined-document"],
  ["docs", "documents", "st-doc", "stacked-document"],
  ["tag-doc", "tagged-document"],
  ["flag", "paper-tape"],
  ["bow-rect", "stored-data", "bow-tie-rectangle"],
  ["delay", "half-rounded-rectangle"],
  ["curv-trap", "curved-trapezoid", "display"],
  ["bolt", "com-link", "lightning-bolt"],
];

const OWN_LOOK = ["console", "browser", "person", "bang", "cloud"];

const DIRECTIONS = ["TD", "LR"] as const;

const one = (shape: string, direction: string, options = {}): string[] =>
  render(`flowchart ${direction}\n    A@{ shape: ${shape}, label: "Lbl" }\n`, { width: 40, ...options }).split("\n");

// A node with a link on every side it can take one, so each wall is reached.
const linked = (shape: string, direction: string, borders: "default" | "padless" | "borderless" = "default"): string =>
  renderThemedText(
    `flowchart ${direction}\n    A[a] --> X@{ shape: ${shape}, label: "Middle" } --> B[b]\n    X --> C[c]\n    D[d] --> X\n    X --> E[e]\n`,
    { width: 120, borders },
    "default"
  ).plain;

describe("every name mermaid 12's shape registry answers to draws its own shape, not the rectangle a wrong name falls to", () => {
  it.each(DIRECTIONS)("an alias draws exactly as its family's first name (%s)", (direction) => {
    for (const [first, ...aliases] of FAMILIES) {
      for (const alias of aliases) expect(one(alias, direction), `${alias} as ${first}`).toEqual(one(first, direction));
    }
  });

  it.each(DIRECTIONS)("no family but the rectangle's draws the rectangle (%s)", (direction) => {
    const rectangle = one("rect", direction);
    for (const [first] of FAMILIES.slice(1)) expect(one(first, direction), first).not.toEqual(rectangle);
    for (const shape of OWN_LOOK) expect(one(shape, direction), shape).not.toEqual(rectangle);
  });

  it.each(DIRECTIONS)("`trap-t` is wide on top and `trap-b` wide at the foot, as mermaid 12 draws them (%s)", (direction) => {
    expect(one("trap-t", direction)).toEqual(render(`flowchart ${direction}\n    A[\\Lbl/]\n`, { width: 40 }).split("\n"));
    expect(one("trap-b", direction)).toEqual(render(`flowchart ${direction}\n    A[/Lbl\\]\n`, { width: 40 }).split("\n"));
  });
});

describe("the shapes mermaid 11 and 12 added, each in the glyphs `docs/divergences.md` gives it", () => {
  it.each(DIRECTIONS)("a document waves at its foot, a tagged one folds its corner, a stack shows a second sheet behind (%s)", (direction) => {
    expect(one("doc", direction)).toEqual(["┌───────┐", "│       │", "│  Lbl  │", "│       │", "└‿⁀‿⁀‿⁀‿┘"]);
    expect(one("tag-rect", direction)).toEqual(["┌───────┐", "│       │", "│  Lbl  │", "│       │", "└───────◢"]);
    expect(one("docs", direction)).toEqual([" ┌───────┐", "┌┴──────┐│", "│  Lbl  ││", "│       ││", "└‿⁀‿⁀‿⁀‿┴┘"]);
  });

  it.each(DIRECTIONS)("a window pane rules its lid off and lines its left wall, the two lines never crossing (%s)", (direction) => {
    expect(one("win-pane", direction)).toEqual(["┌────────┐", "├────────┤", "││  Lbl  │", "││       │", "└────────┘"]);
  });

  it.each(DIRECTIONS)("a folder carries its tab, a loop limit and a manual input cut their lids (%s)", (direction) => {
    expect(one("folder", direction)).toEqual(["┌──┐", "│  └────┐", "│  Lbl  │", "│       │", "└───────┘"]);
    expect(one("notch-pent", direction)).toEqual(["  ▁▁▁▁▁", " ╱     ╲", "│  Lbl  │", "│       │", "└───────┘"]);
    expect(one("sl-rect", direction)).toEqual(["    ▁▁▁▁", "▁▁▁╱    │", "│  Lbl  │", "│       │", "└───────┘"]);
  });

  it.each(DIRECTIONS)("a delay rounds its right end, a display points its left one (%s)", (direction) => {
    expect(one("delay", direction)).toEqual(["┌───────╮", "│       )", "│  Lbl  )", "│       )", "└───────╯"]);
    expect(one("curv-trap", direction)).toEqual([" ────────╮", "/        )", "⟨   Lbl  )", "\\        )", " ────────╯"]);
  });

  it.each(DIRECTIONS)("a junction, a summary and a com link are marks that write no name, as mermaid 12 writes none (%s)", (direction) => {
    for (const [shape, mark] of [["f-circ", "●"], ["cross-circ", "⊗"], ["bolt", "↯"]] as const) {
      const drawn = one(shape, direction).join("\n");
      expect(drawn, shape).toContain(mark);
      expect(drawn, shape).not.toContain("Lbl");
    }
  });

  it.each(DIRECTIONS)("a triangle is a mark with its name under it (%s)", (direction) => {
    for (const [shape, mark] of [["tri", "△"], ["flip-tri", "▽"]] as const) {
      const rows = one(shape, direction);
      const at = rows.findIndex((row) => row.includes(mark));
      expect(rows[at + 1], shape).toContain("Lbl");
    }
  });

  it.each(DIRECTIONS)("a console, a browser, a person, a cloud and a bang each keep their sign (%s)", (direction) => {
    for (const [shape, sign] of [["console", "╭>_"], ["browser", "╭•••"], ["person", "☻"], ["cloud", "╭⁀⁀"], ["bang", "╱╲╱╲"]] as const) {
      expect(one(shape, direction).join("\n"), shape).toContain(sign);
    }
  });

  it.each(DIRECTIONS)("under every border mode, with a link on every side, a new shape keeps its name and crosses no line (%s)", (direction) => {
    const shapes = [...FAMILIES.map(([first]) => first), ...OWN_LOOK, "div-rect", "notch-rect"].filter((shape) => !["f-circ", "cross-circ", "bolt"].includes(shape));
    for (const borders of ["default", "padless", "borderless"] as const) {
      for (const shape of shapes) {
        const drawn = linked(shape, direction, borders);
        expect(drawn, `${shape} ${borders}`).toContain("Middle");
        expect(drawn, `${shape} ${borders}`).not.toContain("┼");
      }
    }
  });

  it.each(DIRECTIONS)("a data store opens both its ends, a link leaving one starting on no wall (%s)", (direction) => {
    const drawn = render(`flowchart ${direction}\n    A@{ shape: datastore, label: "Ledger" } --> B[Next]\n`, { width: 60 });
    expect(drawn).not.toMatch(direction === "LR" ? /├/u : /┤|├/u);
  });
});

describe("a FontAwesome `fa:fa-name` shows nothing, as mermaid 12 shows nothing without FontAwesome's stylesheet", () => {
  const SOURCE = (direction: string): string =>
    `flowchart ${direction}\n  A["fa:fa-car Car"] -->|fab:fa-twitter hi| B[fa:fa-ban] --> C(for fa:fa-heart peace)\n  subgraph S [fas:fa-box Box]\n  D\n  end\n`;

  it.each(DIRECTIONS)("in a node, an edge label and a subgraph title, the words either side closing up (%s)", (direction) => {
    const drawn = render(SOURCE(direction), { width: 100 });
    expect(drawn).not.toMatch(/fa[bklrs]?:fa-/u);
    for (const words of ["Car", "hi", "for peace", "Box"]) expect(drawn).toContain(words);
  });
});
