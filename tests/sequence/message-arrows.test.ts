import { describe, it, expect } from "vitest";
import { render } from "../../src/index.js";
import { parseSequenceDiagram } from "../../src/diagrams/sequence/parser.js";
import { must } from "../../src/must.js";

describe("an ASYNC message's head, a head and not the bracket its spelling is made of", () => {
  const RIGHT = ">";
  const LEFT = "<";
  const ARROW_RIGHT = "\u23f5";
  const ARROW_LEFT = "\u23f4";
  const seq = (body: string, options = {}): string[] =>
    render(`sequenceDiagram\n${body}\n`, { width: 80, ...options }).split("\n");

  it("points where the message goes, either way round", () => {
    const rows = seq("    Alice-)John: go\n    John--)Alice: back");
    const out = must(rows.find((row) => row.includes("go")));
    const back = must(rows.find((row) => row.includes("back")));
    expect(rows[rows.indexOf(out) + 1]).toEndWith(RIGHT);
    expect((rows[rows.indexOf(back) + 1]).trimStart()).toStartWith(LEFT);
  });

  it("leaves no bracket anywhere on the drawing", () => {
    const drawn = seq("    Alice-)John: go\n    John--)Alice: back").join("\n");
    expect(drawn).not.toContain(")");
    expect(drawn).not.toContain("(");
  });

  it("stays told apart from an ordinary `->>`, which keeps its solid head", () => {
    const rows = seq("    Alice->>John: solid\n    Alice-)John: async\n    John-->>Alice: solid back");
    const at = (label: string): string => rows[rows.findIndex((row) => row.includes(label)) + 1];
    expect(at("solid")).toEndWith(ARROW_RIGHT);
    expect(at("async")).toEndWith(RIGHT);
    expect(at("solid back").trimStart()).toStartWith(ARROW_LEFT);
  });

  it("brings a self-message back on the same head", () => {
    const rows = seq("    John-)John: pense");
    expect(rows.some((row) => row.includes(LEFT))).toBe(true);
  });
});

describe("the sixteen HALF-ARROWS a sequence spells, which were dropped in silence", () => {
  const messages = (source: string) =>
    parseSequenceDiagram(`sequenceDiagram\n${source}\n`).events.filter((event) => event.type === "message");
  const one = (written: string) => {
    const found = messages(`    A${written}B: hi\n`);
    expect(found).toHaveLength(1);
    return found[0];
  };

  const TABLE: ReadonlyArray<readonly [string, string, string, string, boolean, string]> = [
    ["-|\\", "solid", "half", "top", false, "┺"],
    ["-|/", "solid", "half", "bottom", false, "┲"],
    ["--|\\", "dotted", "half", "top", false, "┺"],
    ["--|/", "dotted", "half", "bottom", false, "┲"],
    ["-\\\\", "solid", "stick", "top", false, "⸌"],
    ["-//", "solid", "stick", "bottom", false, "⸝"],
    ["--\\\\", "dotted", "stick", "top", false, "⸌"],
    ["--//", "dotted", "stick", "bottom", false, "⸝"],
    ["/|-", "solid", "half", "top", true, "┹"],
    ["\\|-", "solid", "half", "bottom", true, "┱"],
    ["/|--", "dotted", "half", "top", true, "┹"],
    ["\\|--", "dotted", "half", "bottom", true, "┱"],
    ["//-", "solid", "stick", "top", true, "⸍"],
    ["\\\\-", "solid", "stick", "bottom", true, "⸜"],
    ["//--", "dotted", "stick", "top", true, "⸍"],
    ["\\\\--", "dotted", "stick", "bottom", true, "⸜"],
  ];

  const HEADS = "⏵⏴┺┲┹┱⸌⸝⸍⸜x><";
  const shaftOf = (drawn: string): string =>
    must(drawn.split("\n").find((row) => [...HEADS].some((head) => row.includes(head))));

  it("reads all sixteen, keeping the line, the half and the end the head sits on", () => {
    for (const [written, line, head, half, reversed] of TABLE) {
      const message = one(written);
      expect({ written, ...message }).toMatchObject({
        written,
        source: "A",
        target: "B",
        lineType: line,
        arrowType: head,
        half,
      });
      expect(message.reversed === true).toBe(reversed);
    }
  });

  it("leaves the sender the sender, a reversed arrow moving the head and never the two ends", () => {
    const message = one("/|-");
    expect(message.source).toBe("A");
    expect(message.target).toBe("B");
    const drawn = render("sequenceDiagram\n    A/|-B: hi\n", { width: 40 });
    const shaft = shaftOf(drawn).trim();
    expect(shaft.startsWith("│┹")).toBe(true);
    expect(shaft.endsWith("─")).toBe(true);
  });

  it("keeps the head at the target's end where the arrow is not reversed", () => {
    const drawn = render("sequenceDiagram\n    A-|\\B: hi\n", { width: 40 });
    const shaft = shaftOf(drawn).trim();
    expect(shaft.endsWith("┺│")).toBe(true);
    expect(shaft.startsWith("─")).toBe(true);
  });

  it("draws a dotted half-arrow dotted, the doubled dash run reaching the line", () => {
    const drawn = render("sequenceDiagram\n    A--|/B: hi\n", { width: 40 });
    expect(drawn).toContain("┄");
    expect(shaftOf(drawn).trim()).toMatch(/^┄+┲│$/u);
  });

  it("prefers the LONGEST spelling, where a shorter one is a prefix of it", () => {
    for (const [long, short] of [
      ["//--", "//-"],
      ["\\\\--", "\\\\-"],
      ["/|--", "/|-"],
      ["\\|--", "\\|-"],
      ["-->>", "->>"],
      ["-->", "->"],
    ] as const) {
      const message = one(long);
      expect(message.target).toBe("B");
      expect(message.lineType).toBe("dotted");
      expect(one(short).lineType).toBe("solid");
    }
  });

  it("draws a diagram made of nothing but half-arrows, where it used to draw nothing at all", () => {
    const source = ["sequenceDiagram", ...TABLE.map(([written]) => `    A${written}B: hi`)].join("\n");
    const drawn = render(source, { width: 60 });
    expect(drawn).not.toBe("");
    const shafts = drawn.split("\n").filter((row) => [...HEADS].some((head) => row.includes(head)));
    expect(shafts).toHaveLength(TABLE.length);
    expect(shafts.filter((row) => row.includes("┄"))).toHaveLength(TABLE.length / 2);
    TABLE.forEach(([written, , , , reversed, glyph], at) => {
      const shaft = shafts[at].trim();
      const expected = reversed ? `│${glyph}` : `${glyph}│`;
      if (!(reversed ? shaft.startsWith(expected) : shaft.endsWith(expected))) {
        throw new Error(`A${written}B should carry ${expected}, the line reads "${shaft}"`);
      }
    });
  });
});

describe("the CONNECTION DOT a sequence writes `()`, which was read as a letter of the participant's name", () => {
  const source =
    "sequenceDiagram\n    participant Alice\n    participant John\n" +
    "    Alice->>()John: Hello John\n    Alice()->>John: How are you?\n    John()->>()Alice: Great!\n";
  const messagesOf = (written: string) =>
    parseSequenceDiagram(written).events.filter((event) => event.type === "message");
  const shaftsOf = (drawn: string): string[] =>
    drawn.split("\n").filter((line) => line.includes("─") && !line.includes("╭") && !line.includes("╰"));

  it("keeps both ends' NAMES, the dot being a mark on the message and never a letter", () => {
    const diagram = parseSequenceDiagram(source);
    expect(diagram.participants.map((participant) => participant.id)).toEqual(["Alice", "John"]);
    expect(messagesOf(source).map(({ source: from, target: to }) => `${from}->${to}`)).toEqual([
      "Alice->John",
      "Alice->John",
      "John->Alice",
    ]);
    expect(diagram.warnings).toEqual([]);
  });

  it("marks the end the dot was written against, and only that one", () => {
    const [toReceiver, toSender, both] = messagesOf(source);
    expect([toReceiver?.dotSource, toReceiver?.dotTarget]).toEqual([undefined, true]);
    expect([toSender?.dotSource, toSender?.dotTarget]).toEqual([true, undefined]);
    expect([both?.dotSource, both?.dotTarget]).toEqual([true, true]);
    const plain = messagesOf("sequenceDiagram\n    A->>B: hi\n")[0];
    expect([plain?.dotSource, plain?.dotTarget]).toEqual([undefined, undefined]);
  });

  it("puts the dot ON the lifeline and pulls the head one cell short of it", () => {
    const [toReceiver, toSender, both] = shaftsOf(render(source, { width: 60 }));
    expect(toReceiver.trimEnd().endsWith("⏵●")).toBe(true);
    expect(toSender.trim().startsWith("●─")).toBe(true);
    expect(both.trim()).toMatch(/^●⏴─+●$/u);
  });

  it("reads the SIDE off the drawing, a message running leftwards wearing its sender's dot on the right", () => {
    const drawn = render("sequenceDiagram\n    participant A\n    participant B\n    B()-->>A: back\n", { width: 40 });
    const shaft = (shaftsOf(drawn)[0] ?? (must(drawn.split("\n").find((line) => line.includes("┄"))))).trim();
    expect(shaft).toMatch(/^⏴┄+●$/u);
  });

  it("marks a LOOP on the two rows its ends use, the head stepping aside for the one it lands on", () => {
    const rows = render("sequenceDiagram\n    participant A\n    A()->>()A: hm\n", { width: 40 }).split("\n");
    const out = rows.findIndex((line) => line.includes("●"));
    expect(rows[out].trim().startsWith("●─")).toBe(true);
    expect(rows[out + 1].trim().startsWith("●⏴")).toBe(true);
  });
});

describe("a bidirectional self-message wears its two heads, which the loop used to leave bare", () => {
  it("carries a head at each end and keeps a row between them, the lifeline showing through the middle", () => {
    const drawn = render("sequenceDiagram\n    A<<->>A: self\n    A<<-->>A: sync", { width: 80 });
    const heads = drawn.split("\n").filter((row) => row.trimStart().startsWith("⏴"));
    expect(heads.length).toBe(4);
    expect(drawn).toMatch(/⏴─+╮\n\s*│\s+│\n\s*⏴─+╯/u);
    expect(drawn).toMatch(/⏴┄+╮\n\s*│\s+\u250a\n\s*⏴┄+╯/u);
  });

  it("leaves the single-headed self loop its one return head", () => {
    const drawn = render("sequenceDiagram\n    A->>A: ping", { width: 80 });
    const heads = drawn.split("\n").filter((row) => row.includes("⏴"));
    expect(heads.length).toBe(1);
  });
});

describe("a self-message loop CLOSED on the right, `autonumber` or not", () => {
  const source = "sequenceDiagram\n    autonumber\n    Alice->>John: Hi\n    John->>John: thinks\n";

  it("draws both corners, on the row of the label and the one under it", () => {
    const rows = render(source, { width: 80 }).split("\n");
    const at = rows.findIndex((row) => row.includes("thinks"));
    expect(at).toBeGreaterThan(0);
    expect(rows[at + 1].trimEnd().endsWith("╮")).toBe(true);
    expect(rows[at + 2].trimEnd().endsWith("╯")).toBe(true);
  });

  it("puts them on ONE column, which is what makes the two runs a loop", () => {
    const rows = render(source, { width: 80 }).split("\n");
    const at = rows.findIndex((row) => row.includes("thinks"));
    const right = rows[at + 1].indexOf("╮");
    expect(right).toBeGreaterThan(0);
    expect(rows[at + 2].indexOf("╯")).toBe(right);
  });

  it("reserves the same room whether the number is drawn or not, the loop closing either way", () => {
    const bare = render("sequenceDiagram\n    Alice->>John: Hi\n    John->>John: thinks\n", { width: 80 });
    expect(bare.split("\n").filter((row) => row.includes("╮") || row.includes("╯")).length).toBeGreaterThan(1);
  });
});
