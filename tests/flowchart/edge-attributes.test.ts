import { describe, it, expect } from "vitest";
import { render, renderThemed } from "../../src/index.js";
import { must } from "../../src/must.js";
import { stripSgr } from "../support/ansi.js";
import { ESC } from "../../src/paint/escapes.js";

describe("a `click` carrying a URL, read and linked", () => {
  const OPEN = (url: string): string => `${ESC}]8;;${url}${ESC}\\`;
  const CLOSE = `${ESC}]8;;${ESC}\\`;
  const URL = "https://ex.com";

  const linked = (source: string): string[] =>
    renderThemed(source, { width: 80 }, "classic")
      .split("\n")
      .map((row) => {
        const from = row.indexOf(OPEN(URL));
        if (from < 0) return "";
        const rest = row.slice(from + OPEN(URL).length);
        const to = rest.indexOf(CLOSE);
        return stripSgr(to < 0 ? rest : rest.slice(0, to));
      })
      .filter((row) => row !== "");

  it("wraps the NAME, and nothing beside it", () => {
    const rows = linked(`flowchart TB\n  A --> B\n  click B "${URL}"`);
    expect(rows).toEqual(["B"]);
  });

  it("underlines what it links, a name that leads somewhere reading as one", () => {
    const row = must(renderThemed(`flowchart TB\n  A --> B\n  click B "${URL}"`, { width: 80 }, "classic")
      .split("\n")
      .find((line) => line.includes(OPEN(URL))));
    expect(row).toContain(`${ESC}[1;4;37mB`);
  });

  it("runs the rule unbroken through a name of two words", () => {
    const row = must(renderThemed(`flowchart TB\n  A[Mon Depot] --> B\n  click A "${URL}"`, { width: 80 }, "classic")
      .split("\n")
      .find((line) => line.includes(OPEN(URL))));
    expect(row).toContain(`${ESC}[4m `);
  });

  it("reads `href` as the same statement", () => {
    const bare = renderThemed(`flowchart TB\n  A --> B\n  click B "${URL}"`, { width: 80 }, "classic");
    const href = renderThemed(`flowchart TB\n  A --> B\n  click B href "${URL}"`, { width: 80 }, "classic");
    expect(href).toBe(bare);
  });

  it("keeps the URL to itself when a tooltip or a target follows", () => {
    const rows = linked(`flowchart TB\n  A --> B\n  click B "${URL}" "a tooltip nobody hovers" _blank`);
    expect(rows).toEqual(["B"]);
  });

  it("takes a comma list", () => {
    expect(linked(`flowchart TB\n  A --> B\n  click A,B "${URL}"`)).toEqual(["A", "B"]);
  });

  it("hangs nothing on a callback, a drawing having no business running the author's code", () => {
    const drawn = renderThemed(
      `flowchart TB\n  A --> B\n  click A callback "a tooltip"\n  click B call fn() "a tooltip"`,
      { width: 80 },
      "classic"
    );
    expect(drawn).not.toContain(`${ESC}]8;;`);
  });

  it("refuses a scheme a terminal would hand to some other program", () => {
    for (const url of ["file:///etc/passwd", "javascript:alert(1)", "vscode://file/tmp"]) {
      const drawn = renderThemed(`flowchart TB\n  A --> B\n  click B "${url}"`, { width: 80 }, "classic");
      expect(drawn).not.toContain(`${ESC}]8;;`);
    }
  });

  it("leaves the drawing itself untouched, a marker spending no column", () => {
    const source = `flowchart TB\n  A --> B\n  click B "${URL}"`;
    expect(render(source, { width: 80 })).toBe(render(`flowchart TB\n  A --> B`, { width: 80 }));
    expect(render(source, { width: 80 })).not.toContain(ESC);
  });

  it("follows the box when the whole canvas is mirrored", () => {
    expect(linked(`flowchart RL\n  A --> B\n  click B "${URL}"`)).toEqual(["B"]);
  });
});

describe("a class hung on a LINK by its name, matched against links and nodes alike", () => {
  const GREEN = "38;2;22;163;74";
  const painted = (source: string): string[] =>
    renderThemed(source, { width: 80 }, "classic")
      .split("\n")
      .filter((row) => row.includes(GREEN));

  it("paints the link the name points at", () => {
    const rows = painted(
      "flowchart LR\n  A e1@--> B\n  classDef solid stroke:#16a34a,fill:#22c55e\n  class e1 solid"
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatch(new RegExp(`${GREEN}m[^\\u001b]*⏵`, "u"));
  });

  it("takes the link's STROKE and never its fill, a line having no interior to fill", () => {
    const rows = painted(
      "flowchart LR\n  A e1@--> B\n  classDef solid stroke:#16a34a,fill:#22c55e\n  class e1 solid"
    );
    expect(rows[0]).not.toContain("48;2;34;197;94");
  });

  it("resolves whichever order the three lines come in", () => {
    const uses = "flowchart LR\n  A e1@--> B\n  class e1 solid\n  classDef solid stroke:#16a34a";
    const declares = "flowchart LR\n  classDef solid stroke:#16a34a\n  class e1 solid\n  A e1@--> B";
    expect(painted(uses)).toHaveLength(1);
    expect(painted(declares)).toHaveLength(1);
  });

  it("paints the named link and no other", () => {
    const rows = painted(
      "flowchart LR\n  A e1@--> B\n  B e2@--> C\n  classDef solid stroke:#16a34a\n  class e1 solid"
    );
    expect(rows).toHaveLength(1);
  });

  it("takes a comma list, over links and over nodes alike", () => {
    const both = painted(
      "flowchart LR\n  A e1@--> B\n  B e2@--> C\n  classDef solid stroke:#16a34a\n  class e1,e2 solid"
    );
    expect(both.length).toBeGreaterThan(0);
    const nodes = painted("flowchart LR\n  A --> B\n  classDef solid stroke:#16a34a\n  class A,B solid");
    expect(nodes.join("\n")).toContain("B");
  });

  it("leaves a class hung on a NODE doing what it always did", () => {
    const rows = painted("flowchart LR\n  A --> B\n  classDef solid stroke:#16a34a\n  class A solid");
    expect(rows.length).toBeGreaterThan(1);
    expect(rows.some((row) => row.includes(`${GREEN}m⏵`))).toBe(false);
  });
});

describe("a link's NAME, read as the link's and never as the node's before it", () => {
  it("takes the name off the node it abuts, whatever the stroke", () => {
    for (const arrow of ["e1@-->", "e1@==>", "e1@-.->", "e1@---"]) {
      const drawn = render(`flowchart LR\n    A ${arrow} B`, { width: 80 });
      expect(drawn).not.toContain("e1");
      expect(drawn).toContain("A");
      expect(drawn).toContain("B");
    }
  });

  it("invents no node out of the properties line that names it", () => {
    const drawn = render("flowchart LR\n    A e1@--> B\n    e1@{ animate: true }", { width: 80 });
    expect(drawn).not.toContain("e1");
    expect((drawn.match(/┌/gu) ?? []).length).toBe(2);
  });

  it("drops it whichever way round the two lines are written, the names being read up front", () => {
    const after = render("flowchart LR\n    A e1@--> B\n    e1@{ animate: true }", { width: 80 });
    const before = render("flowchart LR\n    e1@{ animate: true }\n    A e1@--> B", { width: 80 });
    expect(before).toBe(after);
  });

  it("leaves a NODE's own `@{}` alone, which is spelled exactly the same", () => {
    const drawn = render("flowchart LR\n    A@{ shape: cyl } --> B", { width: 80 });
    expect(drawn).toMatch(/[⎜⎝]/u);
    expect(drawn).toContain("A");
  });

  it("leaves an `@` inside a quoted label alone, which is not a name the source handed out", () => {
    expect(render('flowchart LR\n    A["mail@host"] --> B', { width: 80 })).toContain("mail@host");
  });
});
