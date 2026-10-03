import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { render } from "../../src/index.js";
import { must } from "../../src/must.js";
import { UNICODE } from "../../src/canvas/charsets.js";

// The mark an end state is drawn with, read off the set rather than spelt, so a glyph swap moves one field.
const END = UNICODE.framedCircle;

describe("the edges leaving a start mark, drawn as one weighted tree", () => {
  it("shares a DOUBLE trunk between two exits and a HEAVY one among three", () => {
    const two = render("stateDiagram-v2\n    direction LR\n    [*] --> A\n    [*] --> B\n", { width: 80 });
    expect(two).toContain("●═╡");
    const three = render("stateDiagram-v2\n    direction LR\n    [*] --> A\n    [*] --> B\n    [*] --> C\n", { width: 80 });
    expect(three).toContain("●━┽─⏵");
  });

  it("keeps the spine heavy only where it still carries two or more, down the page too", () => {
    const three = render("stateDiagram-v2\n    direction TB\n    [*] --> A\n    [*] --> B\n    [*] --> C\n", { width: 80 });
    expect(three).toMatch(/●\n\s*┃\n\s*╭─+╀─+╮/u);
    const two = render("stateDiagram-v2\n    direction TB\n    [*] --> A\n    [*] --> B\n", { width: 80 });
    expect(two).toMatch(/●\n\s*║\n\s*╭─+╨─+╮/u);
  });

  it("puts five branches on ONE spine, and seats three arrivals on three sides of the end", () => {
    const drawn = render(readFileSync("fixtures/state/tree.mmd", "utf8").replace("stateDiagram-v2", "stateDiagram-v2\n    direction LR"), { width: 120 });
    expect(drawn).toMatch(/●━+╉─+⏵/u);
    expect(drawn).toMatch(/\n\s*┟─+⏵/u);
    expect(drawn).toMatch(/\n\s*┞─+⏵/u);
    expect(drawn).not.toMatch(/●━+┿/u);
    expect(drawn).toMatch(new RegExp(String.raw`Archive\s+├─+⏵${END}`, "u"));
    const rows = drawn.split("\n");
    const end = rows.findIndex((r) => r.includes(END));
    const col = [...(rows[end])].indexOf(END);
    expect([...(rows[end - 1])][col]).toBe("⏷");
    expect([...(rows[end + 1])][col]).toBe("⏶");
  });

  it("turns a lone elbow halfway down its gap, not along the border of the box beside it", () => {
    const drawn = render(readFileSync("fixtures/state/tree.mmd", "utf8"), { width: 128 });
    const rows = drawn.split("\n");
    const border = rows.findIndex((r) => /╰─+┬─┬─+╯/u.test(r));
    expect(border).not.toBe(-1);
    expect(rows[border + 1]).toMatch(/^\s+│ │\s/u);
    expect(rows[border + 2]).toMatch(/^\s+│ ╰─+╮/u);
    expect(rows[border + 4]).toMatch(/⏷\s+⏷/u);
  });

  it("draws a run across where it dipped down to come back up", () => {
    const drawn = render("graph LR\nA & B --> C & D\n", { width: 60 });
    expect(drawn).toMatch(/│  B  ├─+╯/u);
    expect(drawn).not.toMatch(/╰─+╯/u);
    const rows = drawn.split("\n");
    expect(rows.filter((r) => r.includes("│─⏵")).length).toBe(1);
  });

  it("keeps one blank row under a box's label, so an arrow into the box lands on its content's own row", () => {
    const drawn = render(
      "stateDiagram-v2\n    direction LR\n    [*] --> First\n    state First {\n        [*] --> second\n        second --> [*]\n    }\n",
      { width: 80 }
    );
    expect(drawn).toMatch(/│\s+First\s+│\n\s*├─+┤\n\s*│\s+│\n\s*│\s+╭─+╮\s+│/u);
    expect(drawn).toMatch(new RegExp(String.raw`●─+⏵│\s+●─+⏵│\s+second\s+├─+⏵${END}\s+│`, "u"));
  });

  it("keeps one row between two composites stacked across the page, the trunk's own", () => {
    const drawn = render(
      "stateDiagram-v2\n    direction LR\n    [*] --> First\n    state First {\n        [*] --> second\n        second --> [*]\n    }\n    [*] --> Another\n    state Another {\n        [*] --> simple\n        simple --> [*]\n    }\n",
      { width: 80 }
    );
    expect(drawn).toMatch(/╘═+╛\n\s*●═+╡\n\s*│\s+╭─+╮/u);
  });

  it("draws a `<<choice>>` as a bare diamond, its id never written, the guards on its branches", () => {
    const drawn = render(
      "stateDiagram-v2\n    direction LR\n    state if_state <<choice>>\n    [*] --> IsPositive\n    IsPositive --> if_state\n    if_state --> False: if n < 0\n    if_state --> True : if n >= 0\n",
      { width: 80 }
    );
    expect(drawn).not.toContain("if_state");
    expect(drawn).toMatch(/IsPositive\s+├─+⏵⟐ ═+╡/u);
    expect(drawn).toContain("if n < 0");
    expect(drawn).toContain("if n >= 0");
  });

  it("seats every run into a `<<join>>` on its long face, a head each, and fans a `<<fork>>` the same way", () => {
    const drawn = render(
      "stateDiagram-v2\n    direction TB\n    state fork_state <<fork>>\n    [*] --> fork_state\n    fork_state --> State2\n    fork_state --> State3\n    state join_state <<join>>\n    State2 --> join_state\n    State3 --> join_state\n    join_state --> State4\n    State4 --> [*]\n",
      { width: 80 }
    );
    expect(drawn).not.toMatch(/█─/u);
    expect(drawn).not.toMatch(/─█/u);
    expect(drawn).toMatch(/⏷\s+⏷\n\s*█+\n/u);
    expect(drawn).toMatch(/█+\n\s*│\s+│\n/u);
  });

  it("cuts a composite into concurrent regions on `--`, each a dashed box with a start of its own", () => {
    const drawn = render(readFileSync("fixtures/state/concurrency.mmd", "utf8"), { width: 120 });
    expect(drawn.split("┌┄").length - 1).toBe(3);
    expect((drawn.match(/●/gu) ?? []).length).toBe(4);
    expect(drawn).toContain("Active");
    const rows = drawn.split("\n");
    const lid = rows.findIndex((r) => r.includes("┌┄"));
    expect(rows[lid + 1]).toMatch(/^[\s│]*┊\s+┊/u);
    expect(rows[lid + 2]).toMatch(/[●╭]/u);
    for (const row of rows) expect(row).not.toMatch(/[A-Za-z]┊[A-Za-z]|Pressed┊|┊Ev/u);
  });

  it("seats a start between the two boxes it feeds, and leaves it on a double trunk", () => {
    const drawn = render(
      "stateDiagram-v2\n    direction LR\n    [*] --> First\n    state First {\n        a\n    }\n    [*] --> Second\n    state Second {\n        b\n    }\n",
      { width: 80 }
    );
    const rows = drawn.split("\n");
    const mark = rows.findIndex((r) => r.includes("●"));
    expect(rows[mark]).toMatch(/●═+╡\s*$/u);
    const first = rows.findIndex((r) => r.includes("First"));
    const second = rows.findIndex((r) => r.includes("Second"));
    expect(mark).toBeGreaterThan(first);
    expect(mark).toBeLessThan(second);
    expect(drawn).toMatch(/╭─⏵│/u);
    expect(drawn).toMatch(/╰─⏵│/u);
  });

  it("seats two boxes one node points at side by side, in the one layer they both earned", () => {
    const drawn = render("flowchart LR\n    S --> First\n    subgraph First\n        a1 --> a2\n    end\n    S --> Second\n    subgraph Second\n        b1 --> b2\n    end\n", { width: 80 });
    const rows = drawn.split("\n");
    const first = rows.findIndex((r) => r.includes("First"));
    const second = rows.findIndex((r) => r.includes("Second"));
    expect(first).not.toBe(-1);
    expect(second).toBeGreaterThan(first);
    expect([...(rows[first])].indexOf("┌")).toBe([...(rows[second])].indexOf("┌"));
  });
});

describe("a start mark joined to one box, seated at the box's middle", () => {
  const regions = readFileSync("fixtures/state/concurrency.mmd", "utf8");

  it("stands over the middle of the composite in TB, its trunk falling on the lid's centre", () => {
    const rows = render(regions.replace("stateDiagram-v2", "stateDiagram-v2\n    direction TB"), { width: 200 }).split("\n");
    const mark = must(rows.find((row) => row.includes("●")));
    const lid = must(rows.find((row) => row.includes("╭──")));
    const centre = Math.floor((lid.indexOf("╭") + lid.lastIndexOf("╮")) / 2);
    expect(Math.abs(mark.indexOf("●") - centre)).toBeLessThanOrEqual(1);
  });

  it("runs straight into the composite's side on the middle region's row in LR", () => {
    const rows = render(regions, { width: 120 }).split("\n");
    const trunk = must(rows.find((row) => /^\s*●─+⏵│/u.test(row)));
    expect(trunk).toBeDefined();
    expect(trunk).toMatch(/●─+⏵│ ┊\s+●─+⏵│\s+CapsLockOff/u);
  });
});

describe("a mail flow under one start, drawn without a crossing", () => {
  const source = [
    "stateDiagram-v2",
    "    [*] --> Inbox",
    "    [*] --> Backlog",
    "    [*] --> Archive",
    "    [*] --> Spam",
    "    Inbox --> Triage",
    "    Triage --> Urgent",
    "    Triage --> Routine",
    "    Backlog --> Planned",
    "    Backlog --> Deferred",
    "    Deferred --> [*]",
    "    Archive --> [*]",
    "    Spam --> Purged",
    "    Purged --> [*]",
  ].join("\n");
  const drawn = render(source, { width: 120 });

  it("seats the end mark under its MIDDLE parent, Archive, so the two others reach it from either side", () => {
    expect(drawn).toMatch(new RegExp(String.raw`╰─+⏵${END}⏴─+╯`, "u"));
  });

  it("keeps the start's four branches on ONE spine row, none lifted off a sibling's corner", () => {
    const rows = drawn.split("\n");
    const spine = rows.filter((row) => /╭─+┮━+┻━+┭─+╮/u.test(row));
    expect(spine).toHaveLength(1);
    expect(rows.some((row) => /│─/u.test(row) || /─│/u.test(row))).toBe(false);
  });
});

describe("a start's tree in the room it needs: trunk, spine, drop, head", () => {
  it("draws `● ┃ ┻ │ ⏷` over five states, one row each", () => {
    const rows = render(readFileSync("fixtures/state/tree.mmd", "utf8").replace("stateDiagram-v2", "stateDiagram-v2\n    direction TB"), { width: 200 }).split("\n");
    const mark = rows.findIndex((r) => r.includes("●"));
    expect(rows[mark + 1]).toMatch(/^\s*┃\s*$/u);
    expect(rows[mark + 2]).toMatch(/╭─+┮━+╇━+┭─+╮/u);
    expect(rows[mark + 3]).toMatch(/^[\s│]+$/u);
    expect(rows[mark + 4]).toMatch(/^[\s⏷]+$/u);
    expect(rows[mark + 5]).toContain("╭");
  });

  it("draws `● │ ⏷` over a composite's lid, one line and the head", () => {
    const source = readFileSync("fixtures/state/concurrency.mmd", "utf8").replace("stateDiagram-v2", "stateDiagram-v2\n    direction TB");
    const rows = render(source, { width: 200 }).split("\n");
    const mark = rows.findIndex((r) => r.includes("●"));
    expect(rows[mark + 1]).toMatch(/^\s*│\s*$/u);
    expect(rows[mark + 2]).toMatch(/^\s*⏷\s*$/u);
    expect(rows[mark + 3]).toMatch(/╭─+╮/u);
  });

  it("draws `● │ ⏷` over a plain state as well", () => {
    const rows = render("stateDiagram-v2\n    direction TB\n    [*] --> A\n    A --> B\n", { width: 40 }).split("\n");
    const mark = rows.findIndex((r) => r.includes("●"));
    expect(rows[mark + 1]).toMatch(/^\s*│\s*$/u);
    expect(rows[mark + 2]).toMatch(/^\s*⏷\s*$/u);
    expect(rows[mark + 3]).toContain("╭");
  });
});
