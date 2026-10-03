import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { render, renderThemed } from "../../src/index.js";
import { must } from "../../src/must.js";
import { UNICODE } from "../../src/canvas/charsets.js";
import { join } from "node:path";
import { stripSgr } from "../support/ansi.js";

describe("a FORK and a JOIN in a flowchart, drawn as bars and not as labelled rectangles", () => {
  const bar = (shape: string, label = "Fork or Join"): string[] =>
    render(`flowchart TD\n    A@{ shape: ${shape}, label: "${label}" }\n`, { width: 60 })
      .split("\n")
      .filter((row) => row.trim() !== "");

  it.each(["fork", "join"])("answers to %s", (name) => {
    const rows = bar(name);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toStartWith("┌");
    expect(rows[1]).toStartWith("└");
  });

  it("closes on two rules and nothing inside, with no block anywhere on the drawing", () => {
    const rows = bar("fork");
    expect(rows[0]).toBe(`┌${"─".repeat(rows[0].length - 2)}┐`);
    expect(rows[1]).toBe(`└${"─".repeat(rows[1].length - 2)}┘`);
    expect(rows.join("\n")).not.toContain("\u2588");
  });

  it("writes NO name, there being nowhere to write one and nothing to say", () => {
    expect(bar("fork").join("\n")).not.toMatch(/[A-Za-z]/u);
  });

  it("takes its LENGTH from the name it does not write, which is what sizes the bar", () => {
    expect((bar("fork", "court")[0]).length).toBeLessThan((bar("fork", "beaucoup plus long")[0]).length);
  });

  it("keeps its own thickness in a band of boxes, where the track is theirs and not its", () => {
    const rows = render('flowchart\n    A[Rectangle] ~~~ B@{ shape: fork, label: "Fork or Join" }\n', { width: 60 })
      .split("\n")
      .filter((row) => row.trim() !== "");
    expect(rows.map((row) => row.slice(-2))).toEqual(["┌┐", "││", "││", "││", "└┘"]);
  });

  it("leaves a state diagram's `<<fork>>` the solid block it has always been drawn with", () => {
    const drawn = render(
      "stateDiagram-v2\n    state Split <<fork>>\n    Start --> Split\n    Split --> Done\n",
      { width: 80 }
    );
    expect(drawn).toContain("\u2588");
  });
});

describe("two MARKS, `sm-circ` and `framed-circle`, drawn beside their names", () => {
  const SMALL = UNICODE.smallCircle;
  const FRAMED = UNICODE.framedCircle;
  const HOURGLASS = "\u29d6";
  const one = (shape: string, label = "Depart", options = {}): string[] =>
    render(`flowchart TD\n    A@{ shape: ${shape}, label: "${label}" }\n`, { width: 60, ...options }).split("\n");

  it.each([
    ["sm-circ", SMALL],
    ["small-circle", SMALL],
    ["start", SMALL],
    ["framed-circle", FRAMED],
    ["stop", FRAMED],
    ["hourglass", HOURGLASS],
    ["collate", HOURGLASS],
  ])("draws %s as a mark and nothing else", (name, mark) => {
    const drawn = one(name).join("\n");
    expect(drawn).toContain(mark);
    for (const rule of ["┌", "┐", "└", "┘", "─", "│", "╭", "╰"]) expect(drawn).not.toContain(rule);
  });

  it.each([["sm-circ", SMALL], ["framed-circle", FRAMED], ["hourglass", HOURGLASS]])(
    "writes the name %s was given, under the mark",
    (name, mark) => {
      const rows = one(name);
      const at = rows.findIndex((row) => row.includes(mark));
      expect(at).toBeGreaterThanOrEqual(0);
      expect(rows[at + 1]).toContain("Depart");
    }
  );

  it("centres the name on the mark, so the two read as one thing", () => {
    const rows = one("sm-circ");
    const at = rows.findIndex((row) => row.includes(SMALL));
    const name = rows[at + 1];
    const middle = name.indexOf("Depart") + Math.floor("Depart".length / 2);
    expect(rows[at].indexOf(SMALL)).toBe(middle);
  });

  it("stands the mark on the row an edge ATTACHES to, which is the block's middle", () => {
    const rows = render(
      `flowchart LR\n    A@{ shape: sm-circ, label: "Depart" } --> B[Etape]\n`,
      { width: 70 }
    ).split("\n");
    const at = rows.findIndex((row) => row.includes(SMALL));
    expect(rows[at]).toContain("⏵");
  });

  it("takes the head FLUSH, having no border for a tee to be cut into", () => {
    const drawn = render(
      `flowchart LR\n    A[Etape] --> B@{ shape: framed-circle, label: "Fin" }\n`,
      { width: 70 }
    );
    expect(drawn).toContain("⏵");
    expect(must(drawn.split("\n").find((row) => row.includes(FRAMED)))).not.toContain("┤");
  });
});

describe("a COMMENT and the two other braced shapes, each read as its shape", () => {
  const HOOK_TOP = "\u23a7";
  const NIB = "\u23a8";
  const HOOK_FOOT = "\u23a9";
  const HOOK_TOP_R = "\u23ab";
  const NIB_R = "\u23ac";
  const HOOK_FOOT_R = "\u23ad";
  const STEM = "\u23aa";
  const one = (shape: string, options = {}): string[] =>
    render(`flowchart TD\n    A@{ shape: ${shape}, label: "Comment" }\n`, { width: 40, ...options }).split("\n");

  it.each([
    ["comment", true, false],
    ["brace", true, false],
    ["brace-l", true, false],
    ["brace-r", false, true],
    ["braces", true, true],
  ])("gives %s a brace on the side its name says, and none on the other", (shape, left, right) => {
    const rows = one(shape);
    const nib = must(rows.find((row) => row.includes("Comment")));
    expect(nib.startsWith(NIB)).toBe(left);
    expect(nib.trimEnd().endsWith(NIB_R)).toBe(right);
    expect(rows.join("\n").includes(HOOK_TOP)).toBe(left);
    expect(rows.join("\n").includes(HOOK_TOP_R)).toBe(right);
  });

  it("lays no fill under any of them, on a theme that fills every box, and no slab under `borderless`", () => {
    for (const shape of ["comment", "brace-r", "braces"]) {
      const source = `flowchart LR\n    A@{ shape: ${shape}, label: "Aside" } --> B[Box]`;
      const drawn = renderThemed(source, { width: 80, background: "light" }, "default");
      const aside = must(drawn.split("\n").find((row) => row.includes("Aside")));
      const [beforeBox] = aside.split("Box");
      expect(beforeBox).not.toMatch(/48;2;[0-9;]+m[^\u001b]*Aside/u);
      expect(drawn).toMatch(/48;2;[0-9;]+m[^\u001b]*Box/u);
      const slab = stripSgr(renderThemed(source, { width: 80, background: "light", borders: "borderless" }, "default"));
      expect(slab.split("\n").find((row) => row.includes("Aside"))).not.toMatch(/[▐▌▄▀]\s+Aside/u);
    }
  });

  it("draws no rule at all where a rectangle would have drawn four", () => {
    const drawn = one("braces").join("\n");
    for (const rule of ["\u2500", "\u2502", "\u250c", "\u2510", "\u2514", "\u2518"]) {
      expect(drawn).not.toContain(rule);
    }
  });

  it("keeps its NIB on the row the name is written on, however tall the box", () => {
    for (const paddingY of [0, 1, 2, 3]) {
      const rows = one("braces", { paddingY });
      const named = rows.findIndex((row) => row.includes("Comment"));
      expect(rows[named]).toContain(NIB);
      expect(rows[named]).toContain(NIB_R);
    }
  });

  it("spends every extra row on the STEM, the hooks staying at the two ends", () => {
    const rows = one("braces", { paddingY: 3 }).filter((row) => row.trim() !== "");
    expect(rows[0]).toStartWith(HOOK_TOP);
    expect(rows[rows.length - 1]).toStartWith(HOOK_FOOT);
    expect(rows[1].startsWith(STEM)).toBe(true);
    expect(rows.filter((row) => row.startsWith(STEM)).length).toBeGreaterThan(1);
  });

  it("is the SHAPE the three names differ by, and not three names for one shape", () => {
    const left = one("comment").join("\n");
    const right = one("brace-r").join("\n");
    expect(left).not.toBe(right);
    expect(left).not.toContain(NIB_R);
    expect(right).not.toContain(NIB);
  });

  it("stays the SAME brace under RL and BT, a comment opening on the left whichever way the graph runs", () => {
    const rl = render(`flowchart RL\n    A@{ shape: comment, label: "Comment" }\n`, { width: 40 });
    expect(rl).toContain(NIB);
    expect(rl).not.toContain(NIB_R);
    const bt = render(`flowchart BT\n    A@{ shape: braces, label: "Comment" }\n`, { width: 40 })
      .split("\n")
      .filter((row) => row.trim() !== "");
    expect(bt[0]).toStartWith(HOOK_TOP);
    expect(bt[0]).toEndWith(HOOK_TOP_R);
    expect(bt[bt.length - 1]).toStartWith(HOOK_FOOT);
    expect(bt[bt.length - 1]).toEndWith(HOOK_FOOT_R);
  });

  it("is kept out of the one order that reads as ONE shape, a comment straight left of a brace-r", () => {
    const source = readFileSync(join(import.meta.dirname, "..", "..", "fixtures", "flowchart", "node-shapes.mmd"), "utf8");
    const named = [...source.matchAll(/shape:\s*([a-z-]+)/gu)].map((match) => match[1]);
    expect(named).toContain("comment");
    expect(named).toContain("brace-r");
    expect(named[named.indexOf("comment") + 1]).not.toBe("brace-r");
  });
});

describe("a double circle MARKED, with no second frame over its label", () => {
  const RING = "\u25ce";
  const LONG = "flowchart TD\n    id1(((This is the text in the circle)))";

  it("keeps every line of a name the second frame was written over", () => {
    const drawn = render(LONG, { width: 80 });
    expect(drawn).toContain("This is the text in");
    expect(drawn).toContain("the circle");
  });

  it("marks the ring on its own border, top and bottom", () => {
    const rows = render(LONG, { width: 80 }).split("\n");
    expect(rows[0]).toContain(RING);
    expect(must(rows.at(-1))).toContain(RING);
    for (const row of rows.slice(1, -1)) expect(row).not.toContain(RING);
  });

  it("tells itself from a single circle, which wears the ring undoubled", () => {
    const single = render("flowchart TD\n    id1((Circle))", { width: 40 });
    expect(single).toContain("\u25ef");
    expect(single).not.toContain(RING);
    expect(render("flowchart TD\n    id1(((Circle)))", { width: 40 })).not.toContain("\u25ef");
  });
});
