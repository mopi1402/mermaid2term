import { describe, it, expect } from "vitest";
import { render, renderThemed } from "../../src/index.js";
import { parseSequenceDiagram } from "../../src/diagrams/sequence/parser.js";
import { must } from "../../src/must.js";
import { ESC } from "../../src/paint/escapes.js";

describe("an `autonumber` worn as a MEDALLION on the cell the arrow leaves from, where mermaid draws a numbered disc of its own", () => {
  const source =
    "sequenceDiagram\n    autonumber\n    Alice->>John: Hello John, how are you?\n    loop HealthCheck\n" +
    "        John->>John: Fight against hypochondria\n    end\n    Note right of John: Rational thoughts!\n" +
    "    John-->>Alice: Great!\n    John->>Bob: How about you?\n    Bob-->>John: Jolly good!\n";
  const rowsOf = (drawn: string): string[] => drawn.split("\n");
  const rowWith = (rows: string[], glyph: string): string => must(rows.find((row) => row.includes(glyph)));
  const lifelineOf = (rows: string[], which: number): number => {
    const floor = rows.findIndex((row) => row.includes("└"));
    const columns = [...(rows[floor + 1])].flatMap((ch, at) => (ch === "│" ? [at] : []));
    return columns[which];
  };

  it("writes the number nowhere in the label, the label keeping the columns it had without it", () => {
    const drawn = render(source, { width: 70 });
    expect(drawn).not.toMatch(/\d: /u);
    const bare = render(source.replace("    autonumber\n", ""), { width: 70 });
    expect(drawn.length).toBe(bare.length);
  });

  it("puts the disc on the sender's lifeline, on the row of the arrow itself", () => {
    const rows = rowsOf(render(source, { width: 70 }));
    const first = rowWith(rows, "❶");
    expect(first.indexOf("❶")).toBe(lifelineOf(rows, 0));
    expect(first.slice(first.indexOf("❶"))).toMatch(/^❶ ─+⏵/u);
    const reply = rowWith(rows, "❸");
    expect(reply.indexOf("❸")).toBe(lifelineOf(rows, 1));
    expect(reply.trimStart().startsWith("⏴")).toBe(true);
  });

  it("puts a self-message's disc where its loop sets off", () => {
    const rows = rowsOf(render(source, { width: 70 }));
    const at = rows.findIndex((row) => row.includes("❷"));
    expect(rows[at].indexOf("❷")).toBe(lifelineOf(rows, 1));
    const loop = rows[at];
    expect(loop.slice(loop.indexOf("❷"))).toMatch(/^❷ ─+╮/u);
    expect(rows[at + 1].indexOf("╯")).toBe(loop.indexOf("╮"));
  });

  it("moves the disc to the far end of a reversed half-arrow, which wears its head at the sender", () => {
    const row = rowWith(rowsOf(render("sequenceDiagram\n    autonumber\n    A/|-B: hi\n", { width: 40 })), "❶");
    const shaft = row.trim();
    expect(shaft.startsWith("│┹")).toBe(true);
    expect(shaft.endsWith("❶")).toBe(true);
  });

  it("reads `autonumber 10 5` as where to start and how far to step, the way mermaid's grammar does", () => {
    const drawn = render(
      "sequenceDiagram\n    autonumber 10 5\n    A->>B: ten\n    B->>A: fifteen\n    A->>B: twenty\n    B->>A: more\n",
      { width: 40 }
    );
    for (const glyph of ["❿", "⓯", "⓴"]) expect(drawn).toContain(glyph);
    const parsed = parseSequenceDiagram("sequenceDiagram\n    autonumber 3\n    A->>B: hi\n");
    expect(parsed.events[0]).toEqual({ type: "autonumber", start: 3, step: undefined, visible: true });
    expect(parsed.warnings).toEqual([]);
    const off = parseSequenceDiagram("sequenceDiagram\n    autonumber off\n    A->>B: hi\n");
    expect(off.events[0]).toEqual({ type: "autonumber", start: undefined, step: undefined, visible: false });
    expect(off.warnings).toEqual([]);
  });

  it("spells a number past twenty digit by digit, the second disc eaten off the shaft on the arrow's side", () => {
    const drawn = render(
      "sequenceDiagram\n    autonumber 20\n    A->>B: right\n    B-->>A: left\n    A->>A: self\n    A/|-B: back\n",
      { width: 44 }
    );
    expect(drawn).toContain("⓴ ─");
    // Nothing ever stands on a disc's right: these are ambiguous-width glyphs, and a terminal that reads them
    // narrow shrinks one drawn a cell and a half wide against whatever the next cell holds, the number coming out
    // small and never bold, where one that reads them wide would write over what the cell held.
    for (const row of drawn.split("\n")) {
      for (const at of [...row].flatMap((ch, i) => (/[❶-❿⓫-⓴⓿]/u.test(ch) ? [i] : []))) {
        expect(row[at + 1] ?? " ", row).toBe(" ");
      }
    }
    expect(drawn).toMatch(/⏴┄+❷ ❶/u);
    expect(drawn).toMatch(/❷ ❷ ─+╮/u);
    expect(drawn).toMatch(/┹─+❷ ❸/u);
    expect(drawn).not.toContain("⓿");
  });

  it("stops counting at a hundred, and spells zero on a disc of the same family", () => {
    const drawn = render("sequenceDiagram\n    autonumber 98\n    A->>B: a\n    B->>A: b\n    A->>B: c\n", { width: 30 });
    expect(drawn).toMatch(/❾ ❽ ─+⏵/u);
    expect(drawn).toMatch(/⏴─+❾ ❾/u);
    expect(drawn).not.toMatch(/\d: /u);
    expect([...drawn].filter((ch) => /[❶-❿⓫-⓴⓿]/u.test(ch))).toHaveLength(4);
    // mermaid reads its start with `sequenceIndex = msg.message.start || sequenceIndex`, so a zero is no value at
    // all and the running count stands: `autonumber 0` numbers the first message one.
    expect(render("sequenceDiagram\n    autonumber 0\n    A->>B: a\n", { width: 30 })).toMatch(/❶ ─+⏵/u);
  });

  it("gives a bidirectional message back the head the disc covered, one cell out along the shaft", () => {
    const drawn = render("sequenceDiagram\n    autonumber\n    A<<->>B: both\n    B<<-->>A: back\n", { width: 40 });
    expect(drawn).toMatch(/❶ ⏴─+⏵/u);
    expect(drawn).toMatch(/⏴┄+⏵❷/u);
  });

  it("leaves a CONNECTION DOT its cell, the disc seated outside the lifeline beside it", () => {
    const drawn = render(
      "sequenceDiagram\n    autonumber 15\n    Alice->>John: a\n    Bob()<<-->>()John: Jolly good!\n" +
        "    John()-->>Bob: one dot\n    Bob()->>Bob: loop\n",
      { width: 60 }
    );
    expect(drawn).toMatch(/●⏴┄+⏵●⓰/u);
    expect(drawn).toMatch(/⓱ ●┄+⏵/u);
    expect(drawn).toMatch(/⓲ ●─+╮/u);
  });

  it("draws a self-message as a HOOK of one width, the label running on over it and never widening the loop", () => {
    const rows = rowsOf(render(source, { width: 70 }));
    const at = rows.findIndex((row) => row.includes("❷"));
    const hook = rows[at];
    expect(hook.indexOf("┐")).toBeLessThan(lifelineOf(rows, 2));
    expect(hook[lifelineOf(rows, 2)]).toBe("│");
    expect(rows[at + 1][lifelineOf(rows, 2)]).toBe("│");
    const label = rows[at - 1];
    expect(label).toContain("Fight against hypochondria");
    expect(hook.lastIndexOf("┊")).toBeGreaterThan(label.indexOf("hypochondria") + "hypochondria".length);
    const both = render("sequenceDiagram\n    autonumber\n    A<<->>A: both\n", { width: 40 });
    expect(both).toMatch(/❶ ⏴─+╮/u);
  });

  it("centres a self-message's label on its lifeline, so a block around the loop stays around that one participant", () => {
    const rows = rowsOf(render(source, { width: 70 }));
    const lid = must(rows.find((row) => row.includes("loop")));
    expect(lid.indexOf("┌")).toBeGreaterThan(lifelineOf(rows, 0));
    expect(lid.lastIndexOf("┐")).toBeLessThan(lifelineOf(rows, 2));
    const label = must(rows.find((row) => row.includes("hypochondria")));
    const start = label.indexOf("Fight");
    const end = label.indexOf("hypochondria") + "hypochondria".length;
    expect(start).toBeLessThan(lifelineOf(rows, 1));
    expect(end).toBeGreaterThan(lifelineOf(rows, 1));
    expect(label).toContain("Fight against hypochondria");
    const first = render("sequenceDiagram\n    A->>A: a rather long thought on the first participant\n    B->>B: x\n", {
      width: 60,
    });
    expect(first).toContain("a rather long thought on the first participant");
  });

  it("paints the disc in the arrow's own ink, being a part of the arrow and not of the label", () => {
    const painted = renderThemed("sequenceDiagram\n    autonumber\n    A->>B: hi\n", { width: 40 }, "neon");
    const disc = must(painted.split(ESC).find((run) => run.includes("❶")));
    const head = must(painted.split(ESC).find((run) => run.includes("⏵")));
    expect(disc.slice(0, disc.indexOf("m"))).toBe(head.slice(0, head.indexOf("m")));
  });
});

describe("an `autonumber` numbering the messages UNDER it, the count running on whether the discs show or not", () => {
  it("leaves the messages above it bare and numbers from its own row on, as mermaid's message stream does", () => {
    const drawn = render(
      "sequenceDiagram\n    A->>B: one\n    autonumber\n    A->>B: two\n    A->>B: three\n",
      { width: 40 }
    );
    // The first message is drawn before the statement is read, so it wears nothing and still spends its number.
    expect(drawn).not.toContain("❶");
    expect(drawn).toMatch(/❷ ─+⏵/u);
    expect(drawn).toMatch(/❸ ─+⏵/u);
  });

  it("resumes at the running count after an `autonumber off`, the messages between having spent their numbers", () => {
    const drawn = render(
      "sequenceDiagram\n    autonumber\n    A->>B: one\n    autonumber off\n    A->>B: two\n    autonumber\n    A->>B: three\n",
      { width: 40 }
    );
    expect(drawn).toMatch(/❶ ─+⏵/u);
    expect(drawn).not.toContain("❷");
    expect(drawn).toMatch(/❸ ─+⏵/u);
  });

  it("takes a new start and a new step from a second statement, keeping what that statement leaves out", () => {
    const drawn = render(
      "sequenceDiagram\n    autonumber 1 2\n    A->>B: one\n    autonumber 10\n    A->>B: ten\n    A->>B: twelve\n",
      { width: 40 }
    );
    expect(drawn).toMatch(/❶ ─+⏵/u);
    expect(drawn).toContain("❿");
    // The step of 2 survives a statement that names only a start, as mermaid's own two `||` reads do: 10 then 12.
    expect(drawn).toMatch(/⓬ ─+⏵/u);
  });
});
