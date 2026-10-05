import { describe, expect, it } from "vitest";
import { render, renderThemed } from "../../src/index.js";
import { ESC } from "../../src/paint/escapes.js";
import { must } from "../../src/must.js";

const SHOP = (direction: string): string =>
  `erDiagram\n    direction ${direction}\n    CUSTOMER ||--o{ ORDER : places\n    ORDER ||--|{ LINE-ITEM : contains\n` +
  "    CUSTOMER {\n        string name\n        string custNumber PK\n    }\n" +
  "    ORDER {\n        int orderNumber PK\n        string deliveryAddress\n    }\n";

// Every left wall a run meets, its ground checked against the row's next painted cell; how many were met.
function jogsOnTheirGround(painted: string): number {
  const ground = (run: string): string | undefined => /48;2;\d+;\d+;\d+/u.exec(run)?.[0] ?? undefined;
  let jogs = 0;
  for (const row of painted.split("\n")) {
    const runs = row.split(ESC).filter((run) => run !== "[0m");
    runs.forEach((run, at) => {
      if (!/^\[[0-9;]*m.*[●┼╫╰╭─]$/u.test(run) || !/^\[[0-9;]*m▏/u.test(runs[at + 1] ?? "")) return;
      jogs += 1;
      expect(ground(runs[at + 1])).toBeDefined();
      expect(ground(runs[at + 1])).toBe(ground(must(runs.slice(at + 2).find((next) => ground(next) !== undefined))));
    });
  }
  return jogs;
}

const padless = (source: string, width = 120): string[] => render(source, { width, borders: "padless" }).split("\n");

describe("`borders: padless`, an entity box's border moved onto the edge of its cells as a class box's", () => {
  it.each(["TB", "LR"])("hugs the name with its walls and insets the attribute rule, direction %s", (direction) => {
    const rows = padless(SHOP(direction));
    expect(must(rows.find((row) => row.includes("CUSTOMER")))).toMatch(/▕\s+CUSTOMER\s+▏/u);
    expect(must(rows.find((row) => row.includes("custNumber")))).toMatch(/▕ string \| custNumber \| PK ▏/u);
    expect(rows.some((row) => /▕▔+▏/u.test(row))).toBe(true);
    expect(rows.some((row) => /▕▁+▏/u.test(row))).toBe(true);
    expect(rows.some((row) => /▕ ─+ ▏/u.test(row))).toBe(true);
    expect(rows.join("\n")).not.toMatch(/[┌┐└┘│]/u);
  });

  it("lands a relation met on a wall in the column the wall inks, LR", () => {
    const rows = padless(SHOP("LR"));
    const inked = (row: string): number[] =>
      [...row].flatMap((glyph, at) => (glyph === "▏" ? [at] : glyph === "▕" ? [at + 1] : []));
    const met = must(rows.find((row) => row.includes("places")));
    const plain = must(rows.find((row) => row.includes("custNumber")));
    expect(inked(met).slice(0, 2)).toEqual(inked(plain).slice(0, 2));
  });

  it("closes a crow's foot met on a rule against the rule's own eighth, TB", () => {
    const rows = padless(SHOP("TB"));
    const foot = rows.findIndex((row) => row.includes("╭●╮"));
    expect(rows[foot + 1]).toMatch(/▕▔+▏/u);
  });

  it("leaves the default borders alone", () => {
    const drawn = render(SHOP("TB"), { width: 120 });
    expect(drawn).toMatch(/┌─+┐/u);
    expect(drawn).not.toMatch(/[▔▁▕▏]/u);
  });

  it.each([80, 40])("jogs a wall out where text leaves it no cell to step into, the relation touching it, LR at %i", (width) => {
    const rows = padless(SHOP("LR"), width);
    expect(must(rows.find((row) => row.includes("orderNumber")))).toMatch(/●▏int/u);
    expect(must(rows.find((row) => row.includes("deliveryAddress")))).toMatch(/╰▏string/u);
  });

  it.each([80, 40])("lays a jogged wall's free part on the row's own ground, LR at %i", (width) => {
    expect(jogsOnTheirGround(renderThemed(SHOP("LR"), { width, borders: "padless" }, "dark"))).toBeGreaterThan(0);
  });
});

describe("`borders: padless`, a class box met where its text leaves the wall no cell to step into", () => {
  const BASIC = "classDiagram\n    Animal <|-- Duck\n    Animal <|-- Fish\n    Animal : +int age\n    class Duck {\n        +String beakColor\n        +swim()\n    }\n";
  it.each(["TD", "LR"])("jogs the wall out to touch the run, direction %s", (direction) => {
    const drawn = padless(BASIC.replace("classDiagram\n", `classDiagram\n    direction ${direction}\n`), 40).join("\n");
    expect(drawn).not.toMatch(/─▕[+A-Za-z]/u);
  });

  it("lays the jogged wall's free part on the box's ground, LR", () => {
    const source = BASIC.replace("classDiagram\n", "classDiagram\n    direction LR\n");
    expect(jogsOnTheirGround(renderThemed(source, { width: 40, borders: "padless" }, "dark"))).toBeGreaterThan(0);
  });
});
