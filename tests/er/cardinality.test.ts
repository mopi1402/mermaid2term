import { describe, it, expect } from "vitest";
import { render } from "../../src/index.js";
import { must } from "../../src/must.js";

describe("an ER cardinality drawn as a CROW'S FOOT on the line, where UML multiplicities made every ER read as a class diagram", () => {
  const source = `erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains
    CUSTOMER }|..|{ DELIVERY-ADDRESS : uses
`;
  const gallery = `erDiagram
    A ||--|| B : "one to one"
    C ||--o{ D : "one to many"
    E }|--|{ F : "many to many"
    G |o--o| H : "zero-or-one"
`;

  it("stacks the four kinds down a vertical line in one row per end, the label between", () => {
    const rows = render(gallery, { width: 80 }).split("\n");
    const figures = (name: string): string[] => {
      const top = rows.findIndex((row) => row.includes(name));
      const from = Math.max(0, rows[top].indexOf(name) - 8);
      const col = from + rows[top + 2].slice(from).search(/[╪●┼]/u);
      return [top + 2, top + 4].map((at) => rows[at].padEnd(col + 2).slice(col - 1, col + 2));
    };
    expect(figures("A")).toEqual(["═╪═", "═╪═"]);
    expect(figures("C")).toEqual(["═╪═", "╭●╮"]);
    expect(figures("E")).toEqual(["╰┼╯", "╭┼╮"]);
    expect(figures("G")).toEqual(["─●─", "─●─"]);
    const labels = rows[rows.findIndex((row) => row.includes("A")) + 3];
    expect(labels).toContain("one to one");
    expect(labels).toContain("zero-or-one");
    const border = (name: string, below: boolean): string => {
      const top = rows.findIndex((row) => row.includes(name));
      const from = Math.max(0, rows[top].indexOf(name) - 8);
      const col = from + (rows[top + (below ? 2 : -2)]).slice(from).search(/[╪●┼]/u);
      return (rows[top + (below ? 1 : -1)]).slice(col - 1, col + 2);
    };
    expect(border("E", true)).toBe("┬┬┬");
    expect(border("D", false)).toBe("┴┴┴");
    expect(border("B", false)).toBe("─┴─");
    expect(rows.join("\n")).not.toMatch(/[01]\.\.[*1]/u);
  });

  it("keeps the author's order: the parent over its two children, as mermaid lays the order example", () => {
    const rows = render(source, { width: 90 }).split("\n");
    const rowOf = (name: string): number => rows.findIndex((row) => row.includes(name));
    expect(rowOf("CUSTOMER")).toBeLessThan(rowOf("ORDER"));
    expect(rowOf("ORDER")).toBe(rowOf("DELIVERY-ADDRESS"));
    expect(rowOf("LINE-ITEM")).toBeGreaterThan(rowOf("ORDER"));
    expect(rows.join("\n")).toContain("═╪═   ╰┼╯");
  });

  it("folds the figure into one cell across a horizontal run and writes the label on it", () => {
    const drawn = render("erDiagram\n    direction LR\n    CUSTOMER ||--o{ ORDER : places\n    ORDER ||--|{ LINE-ITEM : contains\n", { width: 100 });
    const axis = must(drawn.split("\n").find((row) => row.includes("CUSTOMER")));
    expect(axis).toMatch(/CUSTOMER\s*├╫.* places .*●┤\s*ORDER\s*├╫.* contains .*┼┤\s*LINE-ITEM/u);
  });

  it("writes a bent line's label on the drop under the UPPER figure, labels of a band aligned, and a skip edge's centred on its corridor", () => {
    const schema = "erDiagram\n    USER ||--o{ ORDER : places\n    USER ||--o{ REVIEW : writes\n    ORDER ||--|{ ORDER_ITEM : contains\n    PRODUCT ||--o{ ORDER_ITEM : includes\n    PRODUCT ||--o{ REVIEW : receives\n";
    expect(render(schema, { width: 84 })).toMatch(/═╪═.*\n\s+writes\s.*\n\s+╰─+/u);
    const order = "erDiagram\n    CUSTOMER ||--o{ ORDER : places\n    ORDER ||--|{ LINE-ITEM : contains\n    CUSTOMER }|..|{ DELIVERY-ADDRESS : uses\n";
    const drawn = render(order, { width: 60 });
    expect(drawn).toMatch(/^\s+places\s+uses$/mu);
    expect(drawn).toMatch(/═╪═\s*\n\s+contains\s*\n\s+╭┼╮/u);
    const skip = "erDiagram\n    direction TB\n    USER ||--o{ ORDER : places\n    USER ||--o{ REVIEW : writes\n    ORDER ||--|| REVIEW : x\n";
    expect(render(skip, { width: 84 })).toMatch(/^ writes  │/mu);
  });

  it("anchors a fan's labels on the SPREAD end, each above its own child, never touching", () => {
    const fan =
      "erDiagram\n    direction TB\n    INCIDENT ||--o{ ACTION_ITEM : includes\n    INCIDENT ||--o{ AUDIT_LOG : emits\n";
    const drawn = render(fan, { width: 60 });
    expect(drawn).toMatch(/^\s*includes\s+emits\s*$/mu);
    expect(drawn).not.toMatch(/includes\s{0,3}emits/u);
    expect(drawn).toMatch(/includes\s+emits\s*\n\s*\u256d\u25cf\u256e/u);
  });

  it("spreads two PARALLEL lines apart for their labels, both chips on one row, drops straight", () => {
    const twin =
      'erDiagram\n    direction TB\n    "INCIDENT MANAGEMENT" ||--|| "AUDIT PIPELINE" : links\n    "INCIDENT MANAGEMENT" ||--o{ "AUDIT PIPELINE" : records\n';
    const drawn = render(twin, { width: 60 });
    expect(drawn).toMatch(/\u2550\u256a\u2550\s+\u2550\u256a\u2550\s*\n\s*links\s{2,}records\s*$/mu);
  });

  it("pulls a jogged junction STRAIGHT where the face has room, spending no elbow and no lane", () => {
    const jog =
      "erDiagram\n    direction TB\n    CUSTOMER ||--o{ ORDER : places\n    CUSTOMER {\n        string name\n        string custNumber\n        string sector\n    }\n    ORDER {\n        int orderNumber\n        string deliveryAddress\n    }\n";
    const drawn = render(jog, { width: 60 });
    expect(drawn).toMatch(/═╪═\s*\n\s+places\s*\n\s+╭●╮/u);
    expect(drawn).not.toContain("└┐");
  });

  it("takes a quoted name standing alone, unicode, spaces and markdown included", () => {
    expect(render('erDiagram\n    "This \u2764 Unicode"\n', { width: 40 })).toContain("This \u2764 Unicode");
    const md = render('erDiagram\n    "This **is** _Markdown_"\n', { width: 40 });
    expect(md).toContain("This is Markdown");
    expect(md).not.toContain("**");
    const braced = render(
      'erDiagram\n    "name with space" {\n        string name\n    }\n    "name with space" ||--o{ ORDER : places\n',
      { width: 60 }
    );
    expect(braced).toContain("name with space");
    expect(braced).toContain("string | name");
  });

  it("reads the wordy aliases as the symbols, and two chips of one row never eat each other", () => {
    const symbols = "erDiagram\n    CAR ||--o{ NAMED-DRIVER : allows\n    PERSON }o..o{ NAMED-DRIVER : is\n";
    const wordy =
      "erDiagram\n    CAR 1 to zero or more NAMED-DRIVER : allows\n    PERSON many(0) optionally to 0+ NAMED-DRIVER : is\n";
    const drawn = render(symbols, { width: 70 });
    expect(render(wordy, { width: 70 })).toBe(drawn);
    expect(drawn).toMatch(/allows/u);
    expect(drawn).toMatch(/\bis\b/u);
  });

  it("reads BT as TB upside down and RL as LR mirrored, where both fell into TB", () => {
    const source = (d: string): string =>
      `erDiagram\n    direction ${d}\n    CUSTOMER ||--o{ ORDER : places\n    ORDER ||--|{ LINE-ITEM : contains\n`;
    const bt = render(source("BT"), { width: 80 });
    expect(bt.indexOf("LINE-ITEM")).toBeLessThan(bt.indexOf("CUSTOMER"));
    expect(bt.indexOf("ORDER ")).toBeLessThan(bt.indexOf("CUSTOMER"));
    const rl = render(source("RL"), { width: 110 });
    const row = must(rl.split("\n").find((line) => line.includes("CUSTOMER")));
    expect(row.indexOf("LINE-ITEM")).toBeGreaterThan(-1);
    expect(row.indexOf("LINE-ITEM")).toBeLessThan(row.indexOf("CUSTOMER"));
  });
});
