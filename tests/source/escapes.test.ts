import { describe, it, expect } from "vitest";
import { declaredType, frontmatterTitle, render, renderThemed } from "../../src/index.js";
import { displayWidth } from "../../src/text/width.js";
import { withConfig } from "../support/frontmatter.js";
import { ESC } from "../../src/paint/escapes.js";

const BOM = "﻿";

describe("a leading BOM, taken off before the type is read", () => {
  const declared: ReadonlyArray<readonly [string, string]> = [
    ["pie", 'pie\n    title T\n    "A" : 60\n    "B" : 40\n'],
    ["sequenceDiagram", "sequenceDiagram\n    Alice->>Bob: hi\n"],
    ["gantt", "gantt\n    dateFormat YYYY-MM-DD\n    section S\n    a :2020-01-01, 3d\n"],
    ["mindmap", "mindmap\n  Root\n    Branch\n"],
    ["classDiagram", "classDiagram\n    class Dog {\n      +bark()\n    }\n"],
  ];

  it.each(declared)("still reads %s as its own type", (type, source) => {
    expect(declaredType(BOM + source)).toBe(type);
  });

  it.each(declared)("draws %s exactly as it would without the mark", (_type, source) => {
    expect(render(BOM + source, { width: 60 })).toBe(render(source, { width: 60 }));
  });

  it("keeps a flowchart's direction under the mark", () => {
    const source = "graph LR\n  A[Start] --> B[End]\n";
    expect(render(BOM + source, { width: 60 })).toBe(render(source, { width: 60 }));
  });

  it("takes off a trailing one with the blanks, and draws nothing for it", () => {
    const trailing = `graph LR\n  A --> B\n${BOM}`;
    expect(render(trailing, { width: 60 })).not.toContain(BOM);
  });
});

describe("a `#code;` escape, decoded and never printed letter for letter", () => {
  const HELD = /[\ue021-\ue07e]/u;
  const drawn = (source: string): string => render(source, { width: 90 });

  it("draws the character an escape names, by number and by name alike", () => {
    const out = drawn('flowchart LR\n  A["A double quote:#quot;"] --> B["A dec char:#9829;"]');
    expect(out).toContain("A double quote:\"");
    expect(out).toContain("A dec char:\u2665");
  });

  it("resolves a character the SYNTAX would have eaten, which is the whole point of writing one", () => {
    const out = drawn('flowchart LR\n  A["#35; et #91;x#93;"] -->|"a#124;b"| B["100#37;"]');
    expect(out).toContain("# et [x]");
    expect(out).toContain("a|b");
    expect(out).toContain("100%");
  });

  it("leaves a `#` that names nothing exactly as the author wrote it", () => {
    expect(drawn('flowchart LR\n  A["#tricycle;"] --> B["10 # 20"]')).toContain("#tricycle;");
    expect(drawn('flowchart LR\n  A["#tricycle;"] --> B["10 # 20"]')).toContain("10 # 20");
  });

  it("keeps the `#` of a COLOUR, which opens no escape", () => {
    const source = "flowchart LR\n  A --> B\n  classDef vif stroke:#16a34a;\n  style B fill:#c0ffee;\n  class A vif";
    const painted = renderThemed(source, { width: 60 }, "classic");
    expect(painted).toContain("38;2;22;163;74");
    expect(painted).toContain("48;2;192;255;238");
  });

  it("sizes the box on what it will DRAW, the placeholder being one cell as its character is", () => {
    const escaped = drawn('flowchart LR\n  A["a#35;b"] --> B[x]');
    const typed = drawn('flowchart LR\n  A["a#b"] --> B[x]');
    expect(escaped).toBe(typed);
  });

  it("never lets the placeholder reach the drawing, in any family", () => {
    const sources = [
      'flowchart LR\n  A["#quot;"] --> B["#9829;"]',
      "sequenceDiagram\n  Alice->>Bob: 100#37; s\u00fbr#63;\n  Note over Alice: #quot;oui#quot;",
      'classDiagram\n  class Panier {\n    +total() int\n  }\n  note for Panier "prix #62; 0"',
      "stateDiagram-v2\n  [*] --> Attente : #91;pr\u00eat#93;",
      "gantt\n  title Plan #8212; T1\n  section Un\n  T\u00e2che #35;1 :a1, 2026-01-01, 3d",
      "mindmap\n  root((coeur #9829;))\n    un\n    deux",
      'journey\n  title Le #quot;parcours#quot;\n  section Un\n    Voir: 5: Moi',
    ];
    for (const source of sources) {
      expect([source.slice(0, 12), HELD.test(drawn(source))]).toEqual([source.slice(0, 12), false]);
      expect([source.slice(0, 12), HELD.test(renderThemed(source, { width: 90 }, "neon"))]).toEqual([
        source.slice(0, 12),
        false,
      ]);
    }
  });

  it("carries the WHOLE list of names and not a chosen few", () => {
    for (const [name, char] of [
      ["quot", '"'],
      ["amp", "&"],
      ["lt", "<"],
      ["hearts", "\u2665"],
      ["frac12", "\u00bd"],
      ["rarr", "\u2192"],
      ["Zopf", "\u2124"],
      ["zwnj", "\u200c"],
      ["boxplus", "\u229e"],
    ]) {
      expect([name, drawn(`flowchart LR\n  A["x${"#"}${name};x"] --> B[y]`).includes(`x${char}x`)]).toEqual([
        name,
        true,
      ]);
    }
  });
});

describe("a frontmatter `title`, drawn over the diagram where the frontmatter used to be dropped whole", () => {
  const classes = "classDiagram\n    Animal <|-- Duck\n    Animal <|-- Fish\n";
  const titled = `---\ntitle: Animal example\n---\n${classes}`;
  const rowsOf = (drawn: string): string[] => drawn.split("\n");

  it("writes the title on the first row, a blank row parting it from the drawing", () => {
    const rows = rowsOf(render(titled, { width: 60 }));
    expect(rows[0].trim()).toBe("Animal example");
    expect(rows[1]).toBe("");
    expect(rows[2].trim()).not.toBe("");
    expect(render(titled, { width: 60 })).toEndWith(render(classes, { width: 60 }).trimStart());
  });

  it("centres it over the drawing's widest row", () => {
    const rows = rowsOf(render(titled, { width: 60 }));
    const wide = Math.max(...rows.map(displayWidth));
    const lead = rows[0].length - rows[0].trimStart().length;
    expect(Math.abs(lead - Math.floor((wide - "Animal example".length) / 2))).toBeLessThanOrEqual(1);
  });

  it("reads it whatever the diagram, and takes the quotes YAML allows off it", () => {
    expect(rowsOf(render('---\ntitle: "Order flow"\n---\nflowchart LR\n    A --> B\n'))[0]).toContain("Order flow");
    expect(rowsOf(render("---\ntitle: 'Calls'\n---\nsequenceDiagram\n    A->>B: hi\n"))[0]).toContain("Calls");
    expect(frontmatterTitle(withConfig({ theme: "dark" }, "flowchart LR\n    A --> B\n"))).toBe("");
  });

  it("changes nothing where the frontmatter names no title", () => {
    expect(render(withConfig({ theme: "dark" }, classes), { width: 60 })).toBe(render(classes, { width: 60 }));
  });

  it("folds a title the budget cannot hold on words, cutting only a lone word too long, with the ellipsis a label wears", () => {
    const rows = rowsOf(render("---\ntitle: A title far longer than the room\n---\nflowchart LR\n    A --> B\n", { width: 14 }));
    const head = rows.slice(0, 3).map((row) => row.trim());
    expect(head).toEqual(["A title far", "longer than", "the room"]);
    const cut = rowsOf(render("---\ntitle: Unbreakablewordhere\n---\nflowchart LR\n    A --> B\n", { width: 14 }))[0];
    expect(displayWidth(cut)).toBeLessThanOrEqual(14);
    expect(cut).toEndWith("…");
  });

  it("paints it in the ink a label wears, the drawing under it painted as before", () => {
    const painted = renderThemed(titled, { width: 60 }, "classic");
    expect(painted.replace(new RegExp(`${ESC}\\[[0-9;:]*m`, "gu"), "")).toBe(render(titled, { width: 60 }));
    expect(painted.split("\n")[0]).toContain(`${ESC}[1;37mA`);
  });
});
