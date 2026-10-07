import { describe, it, expect } from "vitest";
import { render } from "../../src/index.js";
import { displayWidth } from "../../src/text/width.js";
import { must } from "../../src/must.js";

const kindSource = (kind: string, line: string): string =>
  `sequenceDiagram\n    participant Alice@{ "type" : "${kind}" }\n    participant Bob\n    Alice->>Bob: ${line}\n`;

const spendsOneColumn = (mark: string, source: string): void => {
  expect(displayWidth(mark)).toBe(1);
  for (const row of render(source, { width: 80 }).split("\n")) expect(displayWidth(row)).toBeLessThanOrEqual(80);
};

const standsOnItsLifeline = (mark: string, source: string): void => {
  const rows = render(source, { width: 80 }).split("\n");
  const head = rows.findIndex((row) => row.includes(mark));
  const at = rows[head].indexOf(mark);
  const named = rows[head + 1];
  expect(named).toContain("Alice");
  expect(named.indexOf("Alice") + 2).toBe(at);
  const life = must(rows.slice(head + 2).find((row) => row.includes("│")));
  expect(life.charAt(at)).toBe("│");
};

describe("a BOUNDARY drawn as the bar, stem and ring mermaid draws, where this drew a box on a stem", () => {
  const RING = "\u25cb";
  const MARK = "\u20dd";
  const WIDE_RING = "\u25ef";
  const source = (): string => kindSource("boundary", "Request from boundary");

  it("draws the bar, the stem and the ring against it, and no box at all", () => {
    const rows = render(source(), { width: 80 }).split("\n");
    const head = must(rows.find((row) => row.includes(RING)));
    expect(head).toBeDefined();
    const at = head.indexOf(RING);
    expect(head.slice(at - 2, at + 1)).toBe(`├─${RING}`);
    expect(rows.join("\n")).not.toContain("┌─┐");
  });

  it("spends ONE column on the ring, which is what the canvas advances and what the layout counts", () => {
    spendsOneColumn(RING, source());
    const drawn = render(source(), { width: 80 });
    expect(drawn).not.toContain(MARK);
    expect(drawn).not.toContain(WIDE_RING);
  });

  it("stands the ring on the lifeline it drops and on the name straight under it", () => {
    standsOnItsLifeline(RING, source());
  });

  it("keeps no header room for rows it does not draw, being its own row and its name's", () => {
    const rows = render(source(), { width: 80 }).split("\n");
    expect(rows[0].trim()).not.toBe("");
  });
});

describe("a COLLECTION drawn as one box BEHIND another, where this cut a tee into each of them", () => {
  const RULE = "\u2581";
  const head = (options = {}): string[] =>
    render(
      'sequenceDiagram\n    participant Alice@{ "type" : "collections" }\n    participant Bob\n' +
        "    Alice->>Bob: go\n",
      { width: 80, ...options }
    ).split("\n");

  it("draws the front box whole, the name inside it, and no tee cut into either of them", () => {
    const rows = head();
    expect(rows[1]).toContain("┐│");
    expect(rows[2]).toContain("├┘");
    expect(rows[2].trimStart()).toStartWith("│  Alice  ├┘");
    expect(rows[3].trimStart()).toStartWith("└─────────┘");
    expect(rows.join("\n")).not.toContain("┬");
    expect(rows.join("\n")).not.toContain("┤");
  });

  it("hangs the box behind one row up and one column out, its wall past the front box's own", () => {
    const rows = head();
    const left = rows[1].indexOf("┌");
    expect(rows[1].charAt(left + 1)).toBe("┴");
    const wall = rows[1].indexOf("┐") + 1;
    expect(rows[1].charAt(wall)).toBe("│");
    expect(rows[0].indexOf(RULE)).toBe(left + 2);
    expect(rows[0].lastIndexOf(RULE)).toBe(wall - 1);
  });

  it("closes the box behind on the last row the front box writes in", () => {
    const rows = head();
    const wall = rows[1].indexOf("┐") + 1;
    expect(rows[2].charAt(wall)).toBe("┘");
    expect(rows[2].charAt(wall - 1)).toBe("├");
  });

  it("keeps the header to the four rows it draws, the rule's row and the box's three", () => {
    const rows = head();
    expect(rows[0].trim()).toBe(RULE.repeat(9));
    expect(rows[0]).not.toContain(" ┌");
  });
});

describe("a CONTROL drawn as the circle with its arrow, where this rested an arrowhead on a box", () => {
  const MARK = "\u27f3";
  const source = (): string => kindSource("control", "Control request");

  it("draws the one cell, and neither box nor arrowhead anywhere", () => {
    const rows = render(source(), { width: 80 }).split("\n");
    const head = rows.findIndex((row) => row.includes(MARK));
    expect(head).toBeGreaterThanOrEqual(0);
    expect(rows.join("\n")).not.toContain("╭─╮");
    expect(rows.join("\n")).not.toContain("◁");
  });

  it("spends ONE column on the mark, which is what the canvas advances and what the layout counts", () => {
    spendsOneColumn(MARK, source());
  });

  it("stands the mark on the lifeline it drops and on the name straight under it", () => {
    standsOnItsLifeline(MARK, source());
  });
});

describe("a participant's kind AND its name read off one line, where an `as` after the metadata lost both", () => {
  const source = 'sequenceDiagram\n    participant API@{ "type": "boundary" } as Public API\n' +
    '    actor DB@{ "type": "database" } as User Database\n    API->>DB: go\n';

  it("keeps the kind the metadata names and the name the `as` gives", () => {
    const drawn = render(source, { width: 90 });
    expect(drawn).toContain("Public API");
    expect(drawn).toContain("User Database");
    expect(drawn).toContain("├─○");
    expect(drawn).toContain("(▁▁▁▁)");
    expect(drawn).not.toContain("│  API  │");
  });

  it("lets the `as` have the last word over an alias written inside the metadata", () => {
    const drawn = render(
      'sequenceDiagram\n    participant A@{ "type": "control", "alias": "Inside" } as Outside\n' +
        "    participant B\n    A->>B: go\n",
      { width: 80 }
    );
    expect(drawn).toContain("Outside");
    expect(drawn).not.toContain("Inside");
  });
});

describe("an ENTITY drawn as the circle standing on its bar, where this drew a box with a rule under it", () => {
  const MARK = "\u235c";
  const source = (): string => kindSource("entity", "Entity request");

  it("draws the one cell, and no box and no rule anywhere", () => {
    const rows = render(source(), { width: 80 }).split("\n");
    const head = rows.findIndex((row) => row.includes(MARK));
    expect(head).toBeGreaterThanOrEqual(0);
    expect(rows.join("\n")).not.toContain("╭─╮");
    const at = rows[head].indexOf(MARK);
    expect(rows[head].charAt(at - 1)).toBe(" ");
    expect(rows[head].charAt(at + 1)).toBe(" ");
  });

  it("spends ONE column on the mark, which is what the canvas advances and what the layout counts", () => {
    spendsOneColumn(MARK, source());
  });

  it("stands the mark on the lifeline it drops and on the name straight under it", () => {
    standsOnItsLifeline(MARK, source());
  });
});

describe("an ACTOR's head given a face", () => {
  const HEAD = "\u263b";
  const seq = (body: string, options = {}): string[] =>
    render(`sequenceDiagram\n${body}\n`, { width: 80, ...options }).split("\n");

  it("wears a face over the shoulders it already had", () => {
    const rows = seq("    actor Alice\n    participant John\n    Alice->>John: la");
    const head = rows.findIndex((row) => row.includes(HEAD));
    expect(head).toBeGreaterThanOrEqual(0);
    expect(rows[head + 1]).toContain("\u2500\u253c\u2500");
    expect(rows[head + 2]).toContain("/ \\");
  });

  it("stands the face on the column its own name is centred under", () => {
    const rows = seq("    actor Alice\n    participant John\n    Alice->>John: la");
    const head = must(rows.find((row) => row.includes(HEAD)));
    const name = must(rows.find((row) => row.includes("Alice") && !row.includes(HEAD)));
    const centre = name.indexOf("Alice") + Math.floor("Alice".length / 2);
    expect(head.indexOf(HEAD)).toBe(centre);
  });

  it("leaves the letter o off the figure entirely", () => {
    const rows = seq("    actor Alice\n    participant John\n    Alice->>John: la");
    const head = rows.findIndex((row) => row.includes(HEAD));
    expect(rows[head]).not.toContain("o");
  });

  it("gives a face to every actor and to no boxed participant", () => {
    const drawn = seq("    actor Alice\n    actor Bob\n    participant John\n    Alice->>John: la").join("\n");
    expect(drawn.split(HEAD).length - 1).toBe(2);
  });
});

describe("a participant kind spelt mermaid's way, read off the metadata", () => {
  it("draws the config spelling exactly as the bare keyword", () => {
    const config = render(
      'sequenceDiagram\n    participant Jobs@{ "type": "queue" }\n    participant DB@{ "type": "database" }\n    Jobs->>DB: drain\n',
      { width: 80 }
    );
    const bare = render("sequenceDiagram\n    queue Jobs\n    database DB\n    Jobs->>DB: drain\n", {
      width: 80,
    });
    expect(config).toBe(bare);
  });

  it("reads the alias key as the label", () => {
    const drawn = render(
      'sequenceDiagram\n    participant DB@{ "type": "database", "alias": "Orders DB" }\n    DB->>DB: vacuum\n',
      { width: 80 }
    );
    expect(drawn).toContain("Orders DB");
  });
});

describe("a sequence participant's box ALWAYS rounded, as mermaid rounds its rect", () => {
  it("rounds every rectangle a participant is drawn as: its head, its foot on destroy, its link menu", () => {
    const drawn = render(
      "sequenceDiagram\n    participant A as Alice\n    participant B as Bob\n    link A: Wiki @ https://w\n    A->>B: hi\n    destroy B\n    B-->>A: bye",
      { width: 80 }
    );
    expect(drawn).toContain("╭");
    expect(drawn).toContain("╯");
    expect(drawn.split("\n")[0]).toMatch(/^\s*╭─+╮\s*$/u);
    expect(drawn).not.toMatch(/[┌┐└┘]/u);
  });

  it("leaves a note's corners SQUARE, and the stack of cards a `collections` participant is", () => {
    const drawn = render("sequenceDiagram\n    participant A\n    collections C\n    Note over A: think\n    A->>C: hi", { width: 80 });
    expect(drawn).toMatch(/┌─+┐/u);
    expect(drawn).toMatch(/│ think │/u);
    expect(drawn).toMatch(/└─+┘/u);
    expect(drawn).toMatch(/┌┴─+┐│/u);
  });
});
