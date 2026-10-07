import { describe, it, expect } from "vitest";
import { render, renderThemed } from "../../src/index.js";
import { parseSequenceDiagram } from "../../src/diagrams/sequence/parser.js";
import { must } from "../../src/must.js";
import { stripSgr } from "../support/ansi.js";
import { ESC } from "../../src/paint/escapes.js";

describe("a `<br/>` written in a participant's ALIAS, which was drawn as the five letters it is spelt with", () => {
  const source =
    "sequenceDiagram\n    participant Alice as Alice<br/>Johnson\n    participant John\n" +
    "    Alice->>John: hi\n";
  const rowsOf = (drawn: string): string[] => drawn.split("\n");

  it("breaks the name where the alias says, and takes the tag out of the drawing", () => {
    const named = parseSequenceDiagram(source).participants[0];
    expect(named).toMatchObject({ id: "Alice", label: "Alice\nJohnson" });
    expect(render(source, { width: 60 })).not.toContain("<br");
  });

  it("grows the box a row per break, both names ending on the header's own last row", () => {
    const rows = rowsOf(render(source, { width: 60 }));
    expect(rows.filter((row) => row.includes("Alice") || row.includes("Johnson"))).toHaveLength(2);
    const floors = rows.flatMap((row, at) => (row.includes("╰") ? [at] : []));
    expect(new Set(floors).size).toBe(1);
    expect(rows[floors[0]]).toContain("╯");
  });

  it("measures the box on the widest LINE and not on the name end to end", () => {
    const wide = render("sequenceDiagram\n    participant A as A<br/>Bartholomew\n    participant B\n    A->>B: hi\n", {
      width: 70,
    });
    const lid = must(rowsOf(wide).find((row) => row.includes("╭")));
    expect(lid.indexOf("╮") - lid.indexOf("╭") + 1).toBeLessThan(18);
    expect(wide).toContain("Bartholomew");
  });

  it("lifts a SYMBOL by the rows its broken name takes, the name still hanging under it", () => {
    const rows = rowsOf(
      render("sequenceDiagram\n    actor A as Alice<br/>Johnson\n    participant B\n    A->>B: hi\n", { width: 60 })
    );
    const figure = rows.findIndex((row) => row.includes("☻"));
    const first = rows.findIndex((row) => row.includes("Alice"));
    const second = rows.findIndex((row) => row.includes("Johnson"));
    expect([first - figure, second - first]).toEqual([3, 1]);
    expect(rows[second]).toContain("╯");
  });

  it("breaks the name of a participant the diagram brings into being along the way", () => {
    const rows = rowsOf(
      render("sequenceDiagram\n    participant A\n    A->>B: start\n    create participant B as Bob<br/>Barker\n    A->>B: hello\n", {
        width: 60,
      })
    );
    expect(rows.filter((row) => row.includes("Bob"))).toHaveLength(1);
    expect(rows.filter((row) => row.includes("Barker"))).toHaveLength(1);
    expect(rows.findIndex((row) => row.includes("Barker")) - rows.findIndex((row) => row.includes("Bob"))).toBe(1);
  });

  it("reads the break from the ALIAS alone, a bare id keeping what it was written with", () => {
    const bare = parseSequenceDiagram("sequenceDiagram\n    participant Alice<br/>Johnson\n").participants[0];
    expect(bare.label).not.toContain("\n");
  });
});

describe("a participant's `link`s drawn UNFOLDED in its box, each name a hyperlink, where mermaid folds them into a menu", () => {
  const source =
    "sequenceDiagram\n    participant Alice\n    participant John\n" +
    "    link Alice: Dashboard @ https://dashboard.contoso.com/alice\n    link Alice: Wiki @ https://wiki.contoso.com/alice\n" +
    "    link John: Dashboard @ https://dashboard.contoso.com/john\n    link John: Wiki @ https://wiki.contoso.com/john\n" +
    "    Alice->>John: Hello John, how are you?\n    John-->>Alice: Great!\n";
  const OPEN = (url: string): string => `${ESC}]8;;${url}${ESC}\\`;
  const rowsOf = (drawn: string): string[] => drawn.split("\n");

  it("writes the name, a rule, then a row per link, inside a box grown by as many rows", () => {
    const rows = rowsOf(render(source, { width: 70 }));
    expect(rows[1]).toMatch(/│\s+Alice\s+│.*│\s+John\s+│/u);
    expect(rows[2]).toMatch(/^│─+│\s+│─+│/u);
    expect(rows[3]).toMatch(/^│ Dashboard\s+│\s+│ Dashboard\s+│/u);
    expect(rows[4]).toMatch(/^│ Wiki\s+│\s+│ Wiki\s+│/u);
    expect(rows[5]).toMatch(/^╰─+╯/u);
    // Row 6 is the lifeline row the head now leaves below itself, so the first message sits on row 7.
    expect(rows[7]).toContain("Hello John");
  });

  it("paints the rule on the box's own ground, the way every interior row is, and not on the bare page", () => {
    const painted = renderThemed(source, { width: 70, background: "light" }, "default").split("\n");
    const grounds = (row: string): Set<string> => new Set([...row.matchAll(/48;2;\d+;\d+;\d+/gu)].map((hit) => hit[0]));
    expect(grounds(must(painted[2])).size).toBeGreaterThan(0);
    expect(grounds(must(painted[2]))).toEqual(grounds(must(painted[1])));
  });

  it("hangs each URL on the cells of its own name, underlined, and on nothing beside it", () => {
    const painted = renderThemed(source, { width: 70 }, "classic");
    expect(painted).toContain(OPEN("https://dashboard.contoso.com/alice"));
    expect(painted).toContain(OPEN("https://wiki.contoso.com/john"));
    const row = painted.split("\n")[3];
    const inside = row.slice(row.indexOf(OPEN("https://dashboard.contoso.com/alice")));
    const linked = stripSgr(inside.slice(0, inside.indexOf(`${ESC}]8;;${ESC}\\`)));
    expect(linked.replace(OPEN("https://dashboard.contoso.com/alice"), "")).toBe("Dashboard");
    expect(inside).toMatch(/\[(?:\d+;)*4;/u);
  });

  it("reads the JSON `links` too, keeps a name whose scheme a terminal may not open and links it to nothing", () => {
    const json =
      "sequenceDiagram\n    participant A\n" +
      '    links A: {"Repo": "https://github.com/a", "Mail": "mailto:a@x.io", "Bad": "javascript:alert(1)"}\n    A->>B: hi\n';
    const parsed = parseSequenceDiagram(json);
    expect(parsed.participants[0].links).toEqual([
      { label: "Repo", url: "https://github.com/a" },
      { label: "Mail", url: "mailto:a@x.io" },
      { label: "Bad", url: undefined },
    ]);
    const painted = renderThemed(json, { width: 40 }, "classic");
    expect(render(json, { width: 40 })).toContain("│ Bad ");
    expect(painted).not.toContain("javascript");
    expect(painted).toContain(OPEN("mailto:a@x.io"));
  });

  it("says so where the participant is unknown or the JSON unreadable, as mermaid drops those lines", () => {
    const parsed = parseSequenceDiagram(
      "sequenceDiagram\n    participant A\n    link Nobody: X @ https://x.io\n    links A: {broken\n    A->>A: hi\n"
    );
    expect(parsed.warnings).toHaveLength(2);
    expect(parsed.participants[0].links).toHaveLength(0);
  });

  it("keeps a name written twice once, under its last URL, the way mermaid's object does", () => {
    const parsed = parseSequenceDiagram(
      "sequenceDiagram\n    participant A\n    link A: Wiki @ https://one.io\n    link A: Wiki @ https://two.io\n"
    );
    expect(parsed.participants[0].links).toEqual([{ label: "Wiki", url: "https://two.io" }]);
  });

  it("hangs them under the NAME of a symbol, which has no box to open", () => {
    const rows = rowsOf(render("sequenceDiagram\n    actor A as Alice\n    link A: Repo @ https://r.io\n    A->>B: hi\n", { width: 40 }));
    const name = rows.findIndex((row) => row.includes("Alice"));
    const lifeline = rows[name + 2].indexOf("│");
    expect(rows[name + 1].indexOf("Repo")).toBe(lifeline - 2);
  });

  it("widens the box to its widest link where the name is the shorter", () => {
    const rows = rowsOf(render("sequenceDiagram\n    participant A\n    link A: Operations dashboard @ https://o.io\n    A->>B: hi\n", { width: 60 }));
    expect(rows[3]).toMatch(/^│ Operations dashboard │/u);
  });
});
