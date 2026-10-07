import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";
import { parseSequenceDiagram } from "../../src/diagrams/sequence/parser.js";
import { must } from "../../src/must.js";
import { TWO_PANES } from "../support/drawn.js";
import { withConfig } from "../support/frontmatter.js";

const rowsOf = (drawn: string): string[] => drawn.split("\n");

describe("sequence statements mermaid reads that were dropped or read as something else", () => {
  it("draws the `title` statement above the heads, `title:` too, the last one winning", () => {
    const drawn = rowsOf(render("sequenceDiagram\n    title Checkout flow\n    A->>B: go\n", { width: 60 }));
    expect(drawn[0].trim()).toBe("Checkout flow");
    expect(drawn[1].trim()).toBe("");
    expect(drawn[2]).toContain("╭");
    expect(parseSequenceDiagram("sequenceDiagram\n    title: One\n    title Two\n    A->>B: x\n").title).toBe("Two");
    // Nothing is spent on the rows where no title is written.
    expect(rowsOf(render("sequenceDiagram\n    A->>B: go\n", { width: 60 }))[0]).toContain("╭");
  });

  it("pushes the `box` frame down so a title sits above it and not inside it", () => {
    const rows = rowsOf(render("sequenceDiagram\n    title Front\n    box Purple Web\n    participant A\n    end\n    A->>B: go\n", { width: 60 }));
    expect(rows[0].trim()).toBe("Front");
    expect(rows[2]).toContain("╔");
    expect(rows.filter((row) => row.includes("╔"))).toHaveLength(1);
  });

  it("reads an id written with spaces, in a message, a note, an activation and a link", () => {
    const source =
      "sequenceDiagram\n    participant Order Service\n    Order Service->>B: save\n" +
      "    Note over Order Service,B: both\n    activate B\n    deactivate B\n" +
      "    link Order Service: Docs @ https://x.io\n";
    const parsed = parseSequenceDiagram(source);
    expect(parsed.participants.map((p) => p.id)).toEqual(["Order Service", "B"]);
    expect(parsed.participants[0].links).toEqual([{ label: "Docs", url: "https://x.io" }]);
    expect(parsed.warnings).toEqual([]);
    expect(render(source, { width: 74 })).toContain("Order Service");
  });

  it("reads a config object written over several lines instead of coining a participant named `B@{`", () => {
    const parsed = parseSequenceDiagram('sequenceDiagram\n    participant B@{\n      type: database\n    }\n    A->>B: hi\n');
    expect(parsed.participants.map((p) => p.id)).toEqual(["B", "A"]);
    expect(parsed.participants[0].kind).toBe("database");
  });

  it("unescapes `&equals;` and `&amp;` in a `link` and in a `links` payload, on a line mermaid throws on outright", () => {
    const one = parseSequenceDiagram(
      "sequenceDiagram\n    participant A\n    link A: Docs &amp; API @ https://x.io/?a&equals;1&amp;b&equals;2\n"
    );
    expect(one.participants[0].links).toEqual([{ label: "Docs & API", url: "https://x.io/?a=1&b=2" }]);
    const many = parseSequenceDiagram(
      'sequenceDiagram\n    participant A\n    links A: {"Repo &amp; docs": "https://x.io/?a&equals;1"}\n'
    );
    expect(many.participants[0].links).toEqual([{ label: "Repo & docs", url: "https://x.io/?a=1" }]);
    // mermaid's own `TXT` rule ends at the first `;`, so such a line never reaches its `addALink`: the two
    // replacements there undo its HTML sanitizer. Reading the line at all is the permissive-parsing divergence.
  });

  it("skips a whole line opening with `#`, and keeps a `#` entity code inside a message", () => {
    const parsed = parseSequenceDiagram("sequenceDiagram\n    # a note to the author\n    A->>B: I #9829; you\n");
    expect(parsed.warnings).toEqual([]);
    expect(parsed.events).toHaveLength(1);
    expect(render("sequenceDiagram\n    # skipped\n    A->>B: I #9829; you\n", { width: 46 })).toContain("I \u2665 you");
  });

  it("keeps a `%%` written after a statement in the text, which is what mermaid's own lexer keeps", () => {
    expect(render("sequenceDiagram\n    A->>B: hi %% text\n", { width: 50 })).toContain("hi %% text");
  });

  it("frames a `par_over` and its sections, which mermaid draws as a `par` whose sections overlap", () => {
    const rows = rowsOf(render("sequenceDiagram\n    A->>B: go\n    par_over both\n        B-->>A: one\n    and second\n        B-->>A: two\n    end\n", { width: 60 }));
    const tab = must(rows.find((row) => row.includes("par")));
    expect(tab).toContain("par | both");
    expect(rows.some((row) => row.includes("and | second"))).toBe(true);
    // `par` itself is untouched, and no block named `par_over` is drawn.
    expect(rows.join("\n")).not.toContain("par_over");
  });
});

describe("the separator and the folding prefixes mermaid's lexer reads off a statement", () => {
  it("ends a statement at a `;`, as mermaid's lexer does, keeping an entity code that closes on one", () => {
    const parsed = parseSequenceDiagram("sequenceDiagram\n    A->>B: hi; B->>A: ho\n");
    expect(parsed.events).toHaveLength(2);
    expect(parsed.events.map((event) => (event.type === "message" ? event.label : ""))).toEqual(["hi", "ho"]);
    // `#59;` is a semicolon an author asked for and `&equals;` one mermaid's own sanitizer wrote: neither cuts.
    const held = parseSequenceDiagram("sequenceDiagram\n    A->>B: a #59; b\n");
    expect(held.events).toHaveLength(1);
    const linked = parseSequenceDiagram(
      "sequenceDiagram\n    participant A\n    link A: Docs &amp; API @ https://x.io/?a&equals;1\n"
    );
    expect(linked.warnings).toEqual([]);
    expect(linked.participants[0].links).toEqual([{ label: "Docs & API", url: "https://x.io/?a=1" }]);
    // A `@{...}` config reads its braces whole, mermaid's CONFIG lexer state having no `;` rule at all.
    const configured = parseSequenceDiagram('sequenceDiagram\n    participant A@{ "type": "database" }\n');
    expect(configured.participants).toHaveLength(1);
    expect(configured.participants[0].kind).toBe("database");
  });

  it("reads a `wrap:` or `nowrap:` prefix off a label and never draws it", () => {
    for (const [prefix, kept] of [["wrap: ", true], ["nowrap: ", true], ["WRAP: ", false]] as const) {
      const parsed = parseSequenceDiagram(`sequenceDiagram\n    A->>B: ${prefix}hello\n`);
      const message = parsed.events[0];
      expect(message.type === "message" && message.label, prefix).toBe(kept ? "hello" : `${prefix}hello`);
    }
    // Every place mermaid runs `parseMessage`: a block's text, a box's title and an alias, not only a message.
    const rows = render(
      "sequenceDiagram\n    box wrap: Business\n    participant A as wrap: Alpha\n    end\n    loop wrap: daily\n    A->>A: hi\n    end\n",
      { width: 60 }
    ).split("\n");
    expect(rows.join("\n")).not.toContain("wrap:");
    expect(rows.some((row) => row.includes("Business"))).toBe(true);
    expect(rows.some((row) => row.includes("Alpha"))).toBe(true);
    expect(rows.some((row) => row.includes("loop | daily"))).toBe(true);
  });

  it("folds a `wrap:` label with no width asked for, and keeps a `nowrap:` one whole past the budget", () => {
    const long = "a fairly long label that would rather fold";
    const asked = render(`sequenceDiagram\n    A->>B: wrap: ${long}\n`, {}).split("\n");
    expect(asked.filter((row) => row.includes("fairly") || row.includes("rather")).length).toBeGreaterThan(1);
    // Without the prefix the same label buys one row and the page grows instead.
    const plain = render(`sequenceDiagram\n    A->>B: ${long}\n`, {}).split("\n");
    expect(plain.some((row) => row.includes(long))).toBe(true);
    // `nowrap:` refuses the fold the `--width` budget would otherwise force.
    const held = render(`sequenceDiagram\n    A->>B: nowrap: ${long}\n`, { width: 30 }).split("\n");
    expect(held.some((row) => row.includes(long))).toBe(true);
  });
});

describe("numbering and participant keys mermaid 12 reads", () => {
  const discRows = (drawn: string): string[] => drawn.split("\n").filter((row) => row.includes("⏵")).map((row) => row.trim());

  it("numbers from a decimal start and step, rounded to two places as mermaid rounds its count", () => {
    const source = "sequenceDiagram\n    autonumber 0.1 0.2\n    A->>B: one\n    A->>B: two\n    A->>B: three\n";
    const parsed = parseSequenceDiagram(source);
    expect(parsed.events[0]).toEqual({ type: "autonumber", start: 0.1, step: 0.2, visible: true });
    for (const width of TWO_PANES) {
      // 0.1 + 0.2 is drawn 0.3, not 0.30000000000000004.
      const discs = discRows(render(source, { width })).map((row) => row.slice(0, 6));
      expect(discs, `width ${width}`).toEqual(["⓿ . ❶ ", "⓿ . ❸ ", "⓿ . ❺ "]);
    }
    // A leading dot is a number too, and three places is not one: the line is left alone.
    expect(parseSequenceDiagram("sequenceDiagram\n    autonumber .5\n").events[0]).toEqual({ type: "autonumber", start: 0.5, step: undefined, visible: true });
    expect(parseSequenceDiagram("sequenceDiagram\n    autonumber 1.555\n").events).toEqual([]);
  });

  it("drops a participant no message, note or activation names under `hideUnusedParticipants`", () => {
    const source = (flag: string): string =>
      withConfig({ sequence: { hideUnusedParticipants: flag } }, "sequenceDiagram\n    participant C\n    participant D\n    participant E\n") +
      "    box Web\n    participant F\n    end\n    A->>B: one\n    Note over C: n\n    activate D\n    deactivate D\n";
    for (const width of TWO_PANES) {
      const hidden = render(source("true"), { width });
      for (const kept of ["A", "B", "C", "D"]) expect(hidden, `width ${width}`).toMatch(new RegExp(`│ *${kept} *│`, "u"));
      expect(hidden).not.toMatch(/│ *[EF] *│/u);
      expect(hidden).not.toContain("Web");
      expect(render(source("false"), { width })).toMatch(/│ *E *│/u);
    }
  });
});
