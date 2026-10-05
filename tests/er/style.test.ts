import { describe, it, expect } from "vitest";
import { render, renderThemed } from "../../src/index.js";
import { parseERDiagram } from "../../src/diagrams/erdiagram/parser.js";
import { must } from "../../src/must.js";
import { stripSgr } from "../support/ansi.js";

describe("an ER entity dressed by `style`, `classDef` and `:::`, mermaid's three ways", () => {
  const STYLED = `erDiagram
    id1||--||id2 : label
    style id1 fill:#f9f,stroke:#333,stroke-width:4px
    style id2 fill:#bbf,stroke:#f66,stroke-width:2px,color:#fff,stroke-dasharray: 5 5
`;

  it("reads the classDef names an entity wears, wherever the ::: stands", () => {
    const diagram = parseERDiagram(`erDiagram
    CAR:::someclass {
        string make
    }
    HOUSE:::alone
    PERSON:::foo ||--|| CAR : owns
    classDef foo stroke:#f00,fill:#fee
    classDef foo color:#000
`);
    expect(diagram.entities.get("CAR")?.cssClasses).toEqual(["someclass"]);
    expect(diagram.entities.get("HOUSE")?.cssClasses).toEqual(["alone"]);
    expect(diagram.entities.get("PERSON")?.cssClasses).toEqual(["foo"]);
    expect(diagram.classDefs.get("foo")?.get("stroke")).toBe("#f00");
    expect(diagram.classDefs.get("foo")?.get("color")).toBe("#000");
    expect(diagram.warnings).toEqual([]);
  });

  it("reads a `style` line wherever it stands, and one naming no entity styles nothing", () => {
    const diagram = parseERDiagram(`erDiagram
    style id1 fill:#f9f
    id1||--||id2 : label
    style ghost fill:#000
`);
    expect(diagram.entities.get("id1")?.styles.get("fill")).toBe("#f9f");
    expect(diagram.entities.has("ghost")).toBe(false);
    expect(diagram.warnings).toEqual([]);
  });

  it("lexes a symbol cardinality by MEANING and not by side, `o{` on the left the zero-or-many `}o` spells there", () => {
    const diagram = parseERDiagram("erDiagram\n    PERSON o{--|| HOUSE : has\n");
    expect(diagram.relationships[0]?.card1).toBe("}o");
    expect(diagram.relationships[0]?.card2).toBe("||");
    expect(diagram.warnings).toEqual([]);
  });

  it("asks no blank around the cardinalities, `id1||--||id2` being the docs' own spelling", () => {
    const diagram = parseERDiagram("erDiagram\n    id1||--||id2 : label\n");
    expect(diagram.relationships[0]?.entity1).toBe("id1");
    expect(diagram.relationships[0]?.entity2).toBe("id2");
  });

  it("recasts the ring HEAVY from 2px of stroke-width and DASHED for a dasharray, welds carried with it", () => {
    const drawn = render(STYLED, { width: 80 });
    expect(drawn).toMatch(/\u250f\u2501+\u2513/u);
    expect(drawn).toMatch(/\u2503\s+id1\s+\u2520/u);
    expect(drawn).toMatch(/\u250f(?:\u2501 )+/u);
  });

  it("dresses `classDef default` on every entity, the named words riding over it", () => {
    const drawn = render(
      `erDiagram
    PERSON:::foo ||--|| CAR : owns
    classDef default stroke-width:4px
    classDef foo stroke:#f00
`,
      { width: 80 }
    );
    expect(drawn).toMatch(/\u2503\s+PERSON\s+/u);
    expect(drawn).toMatch(/\s+CAR\s+\u2503/u);
  });

  it("dresses a BURIED entity through its panel, the ring recast where it stands", () => {
    const drawn = render(
      `erDiagram
    subgraph pack
      E1 ||--|| E2 : ties
    end
    LEFT ||--|| E2 : links
    style E2 stroke-width:2px
`,
      { width: 80 }
    );
    expect(drawn).toMatch(/\u2528\s+E2\s+\u2503/u);
  });

  it("lays the fill one row in two, as mermaid bands an entity: the name, then every other attribute row", () => {
    const themed = renderThemed(
      `erDiagram
    CAR:::someclass {
        string registrationNumber
        string make
        string model
    }
    classDef someclass fill:#f96
`,
      { width: 80 },
      "neon"
    );
    const FILL = "48;2;255;153;102";
    const rows = themed.split("\n");
    const rowWith = (word: string): string =>
      must(rows.find((row) => stripSgr(row).includes(word)));
    expect(rowWith("CAR")).toContain(FILL);
    expect(rowWith("registrationNumber")).not.toContain(FILL);
    expect(rowWith("make")).toContain(FILL);
    expect(rowWith("model")).not.toContain(FILL);
  });

  it("paints the author's fill, stroke and color, and nothing at all in plain text", () => {
    const themed = renderThemed(STYLED, { width: 80 }, "neon");
    expect(themed).toContain("48;2;255;153;255");
    expect(themed).toContain("38;2;255;102;102");
    expect(themed).toContain("38;2;255;255;255");
    expect(render(STYLED, { width: 80 })).not.toContain("\u001b");
  });
});
