import { describe, it, expect } from "vitest";
import { render } from "../../src/index.js";
import { parseERDiagram } from "../../src/diagrams/erdiagram/parser.js";
import { must } from "../../src/must.js";

describe("\u25c9 an ER `subgraph`, a framed panel laid out on its own and seated in its parent as one block", () => {
  it("reads ids, titles and nesting as mermaid does, a group's id spawning no phantom entity", () => {
    const parsed = parseERDiagram(
      'erDiagram\n    subgraph "Customer Domain"\n        CUSTOMER\n    end\n    subgraph id1 [title 1]\n        direction LR\n        CAR ||--|| PERSON : owns\n        subgraph inner\n            WHEEL\n        end\n    end\n    id1 ||--|| "Customer Domain" : links\n'
    );
    expect(parsed.groups.map((group) => group.id)).toEqual(["Customer Domain", "id1"]);
    expect(parsed.groups[1]?.title).toBe("title 1");
    expect(parsed.groups[1]?.direction).toBe("LR");
    expect(parsed.directionDeclared).toBe(false);
    expect(parsed.groups[0]?.entities).toEqual(["CUSTOMER"]);
    expect(parsed.groups[1]?.entities).toEqual(["CAR", "PERSON"]);
    expect(parsed.groups[1]?.children.map((child) => child.id)).toEqual(["inner"]);
    expect(parsed.entities.has("id1")).toBe(false);
    expect(parsed.entities.has("Customer Domain")).toBe(false);
    expect(parsed.warnings).toEqual([]);
  });

  it("frames each group under its centred title, a nested panel inside its parent's walls", () => {
    const drawn = render(
      "erDiagram\n    subgraph title1\n        CUSTOMER\n        CUSTOMER {\n            string name\n        }\n    end\n    subgraph title2\n        CAR ||--o{ NAMED-DRIVER : allows\n        subgraph title3\n            PERSON\n        end\n    end\n",
      { width: 130 }
    );
    const rows = drawn.split("\n");
    expect(rows.find((row) => row.includes("title3"))).toMatch(/\u2502.*\u2502\s+title3\s+\u2502.*\u2502/u);
    expect(rows.some((row) => /\u2502\s+title1\s+\u2502/u.test(row))).toBe(true);
    expect(rows.find((row) => row.includes("string | name"))).toMatch(/\u2502 \u2502.*\u2502 \u2502/u);
    const axis = must(rows.find((row) => row.includes("CAR")));
    expect(axis).toMatch(/CAR\s*\u251c\u256b.*allows.*\u25cf\u2524\s*NAMED-DRIVER/u);
  });

  it("ties group to group by the frames, and REACHES a buried entity through a hole cut in them", () => {
    const drawn = render(
      "erDiagram\n    subgraph title1\n        A1 ||--|| A2 : links\n    end\n    subgraph title2\n        B1 ||--|| B2 : links\n    end\n    subgraph title3\n        C1 ||--|| C2 : links\n    end\n    title1 ||--|| title2 : links\n    title2 ||--|| title3 : links\n    title2 ||--|| C2 : links\n",
      { width: 60 }
    );
    expect(drawn).toMatch(/\u252c.*\n\s*\u2550\u256a\u2550\s*\n\s*links\s*\n\s*\u2550\u256a\u2550\s*\n.*\u2534/u);
    expect(drawn).toMatch(/\u252c\u2500+\u252c/u);
    expect(drawn).toMatch(/\u250c\u2500+\u2534\u2500+\u2502\u2500+\u2510/u);
    expect(drawn).not.toContain("\u253c");
    expect(drawn).toMatch(/\u2550\u256a\u2550\s*\n[^\n]*\u250c\u2500+\u2534\u2500+\u2510/u);
  });

  it("rides a FLANK lane to the buried box where the straight way is walled off", () => {
    const flat =
      "erDiagram\n    direction LR\n    LEFT ||--|| E2 : links\n    subgraph pack\n        E1 ||--|| E2 : ties\n    end\n";
    const drawn = render(flat, { width: 90 });
    expect(drawn).toMatch(/└───────┬──────┘ │/u);
    expect(drawn).toMatch(/└─+│─+┘/u);
    expect(drawn).toMatch(/╰─+\s+links\s+─+╯/u);
    expect(drawn).not.toContain("┼");
    expect(drawn).toMatch(/\u2502\s+E1\s+\u251c\u256b\u2500+ ties \u2500+\u256b\u2524/u);
  });

  it("reaches a buried box out the far WALL when its floor and its flank are both taken", () => {
    const cross =
      "erDiagram\n    subgraph title1\n        A1 ||--|| A2 : links\n    end\n    subgraph title2\n        B1 ||--|| B2 : links\n    end\n    subgraph title3\n        C1 ||--|| C2 : links\n    end\n    title1 ||--|| title2 : links\n    title2 ||--|| title3 : links\n    title2 ||--|| C2 : links\n    C1 ||--o{ C1 : links\n    C1 ||--o{ A2 : links\n";
    const drawn = render(cross, { width: 100 });
    expect(drawn).toMatch(/╭──╫┤\s+C1/u);
    expect(drawn).toMatch(/╰─+\s+links\s+─+╮/u);
    expect(drawn).toMatch(/╭●╮/u);
    expect(drawn).toMatch(/┴┴┴/u);
    expect(drawn).not.toContain("┼");
  });

  it("rides a CORRIDOR level with the buried box and pierces the frame on its row", () => {
    const stacked =
      "erDiagram\n    subgraph title1\n        A1 ||--|| A2 : links\n    end\n    subgraph title2\n        B1 ||--|| B2 : links\n    end\n    subgraph title3\n        C1 ||--|| C2 : links\n    end\n    title1 ||--|| title2 : links\n    title2 ||--|| C2 : links\n    title1 ||--|| C1 : links\n";
    const drawn = render(stacked, { width: 80 });
    expect(drawn).toMatch(/╰─+╫┤\s+C1\s+│ │/u);
    expect(drawn).toMatch(/╭─+╫┤/u);
    expect(drawn).not.toContain("┼");
  });

  it("draws a relationship from an entity to ITSELF as a loop on its flank", () => {
    const drawn = render(
      "erDiagram\n    EMPLOYEE ||--o{ EMPLOYEE : manages\n    EMPLOYEE }o--|| TEAM : joins\n",
      { width: 80 }
    );
    expect(drawn).toMatch(/EMPLOYEE\s+├╫─+╮/u);
    expect(drawn).toMatch(/╰─+ manages ─+╯/u);
    expect(drawn).toMatch(/╰●╯/u);
    expect(drawn).toMatch(/┬┬┬/u);
    expect(drawn).toMatch(/joins/u);
    expect(drawn).not.toContain("┼");
  });

  it("lets each subgraph flow its own way, RL, BT and the parent's TB in one LR drawing", () => {
    const drawn = render(
      "erDiagram\n    direction LR\n    subgraph TOP\n        direction TB\n        subgraph B1\n            direction RL\n            I1 ||--|| F1 : links\n        end\n        subgraph B2\n            direction BT\n            I2 ||--|| F2 : links\n        end\n    end\n    A ||--|| TOP : links\n    TOP ||--|| B : links\n    B1 ||--|| B2 : links\n",
      { width: 200 }
    );
    const rows = drawn.split("\n");
    const rl = must(rows.find((row) => row.includes("F1")));
    expect(rl.indexOf("F1")).toBeLessThan(rl.indexOf("I1"));
    expect(rows.findIndex((row) => row.includes("F2"))).toBeLessThan(rows.findIndex((row) => row.includes("I2")));
    expect(rows.findIndex((row) => row.includes("B1"))).toBeLessThan(rows.findIndex((row) => row.includes("B2")));
    const axis = must(rows.find((row) => / A /u.test(row)));
    expect(axis.match(/links/gu)?.length).toBe(2);
    expect(axis.indexOf(" A ")).toBeLessThan(axis.lastIndexOf(" B "));
  });
});
