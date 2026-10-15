import { describe, it, expect } from "vitest";
import { render, renderThemed } from "../../src/index.js";
import { must } from "../../src/must.js";

describe("a block named by a CARTOUCHE centred on its own rule and not on a row of its own", () => {
  const source =
    "sequenceDiagram\n    participant A\n    participant B\n    A->>B: check\n    loop every minute\n" +
    "        A->>B: ping\n    end\n";

  it("writes the keyword, a pipe and the condition on the rule, and no bracket anywhere", () => {
    const drawn = render(source, { width: 80 });
    expect(drawn).toContain("loop | every minute");
    expect(drawn).not.toContain("[loop]");
    const rule = must(drawn.split("\n").find((row) => row.includes("┌┄")));
    expect(rule).toContain("loop | every minute");
  });

  it("centres it on the rule, the dashes left and right of it within one column of each other", () => {
    const written = " loop | every minute ";
    const rule = must(render(source, { width: 80 })
      .split("\n")
      .find((row) => row.includes(written)));
    const at = rule.indexOf(written);
    const after = rule.length - (at + written.length);
    expect(Math.abs(at - after)).toBeLessThanOrEqual(1);
  });

  it("keeps the row under the rule CLEAR, so the frame opens on air and not on a message", () => {
    const rows = render(source, { width: 80 }).split("\n");
    const at = rows.findIndex((row) => row.includes("loop | every minute"));
    expect(at).toBeGreaterThan(0);
    expect(rows[at + 1]).toMatch(/^\u250a\s+│\s+│\s+\u250a$/u);
    expect(rows[at + 2]).toContain("ping");
  });

  it("spends on its frame the rows the header row used to cost, and not one more", () => {
    const tall = render(source, { width: 80 }).split("\n").length;
    const flat = render("sequenceDiagram\n    participant A\n    participant B\n    A->>B: check\n", {
      width: 80,
    }).split("\n").length;
    expect(tall - flat).toBe(7);
  });

  it("cuts a condition longer than the frame at the frame's own side, never through it", () => {
    const rows = render(
      "sequenceDiagram\n    participant A\n    participant B\n    A->>B: hi\n" +
        "    loop until the retry budget for this operation is finally exhausted\n        A->>B: tick\n    end\n",
      { width: 80 }
    ).split("\n");
    const rule = must(rows.find((row) => row.includes("loop |")));
    expect(rule.endsWith("┐")).toBe(true);
    expect(rule).not.toContain("exhausted");
  });

  it("paints the lifeline through the hole in its own colour, never the frame's", () => {
    const ink = (row: string, glyph: string): string => {
      const at = row.indexOf(glyph);
      return row.slice(row.lastIndexOf("\u001b[", at), at);
    };
    const rows = renderThemed(source, { width: 80 }, "classic").split("\n");
    const rule = must(rows.find((row) => row.includes("└") && row.includes("│")));
    const lifelines = rows.filter((row) => row.includes("│") && !row.includes("┄"));
    const life = lifelines[lifelines.length - 1];
    expect(ink(rule, "│")).toBe(ink(life, "│"));
    expect(ink(rule, "│")).not.toBe(ink(rule, "┄"));
  });

  it("names an `else` the same way, the keyword it was written with kept for it", () => {
    const drawn = render(
      "sequenceDiagram\n    participant A\n    participant B\n    alt is up\n        A->>B: go\n" +
        "    else is down\n        A->>B: wait\n    end\n",
      { width: 80 }
    );
    expect(drawn).toContain("alt | is up");
    expect(drawn).toContain("else | is down");
  });

  it("keeps the row under an `else` rule clear too, so both cartouches open on air", () => {
    const rows = render(
      "sequenceDiagram\n    participant A\n    participant B\n    alt is up\n        A->>B: go\n" +
        "    else is down\n        A->>B: wait\n    end\n",
      { width: 80 }
    ).split("\n");
    const at = rows.findIndex((row) => row.includes("else | is down"));
    expect(at).toBeGreaterThan(0);
    expect(rows[at + 1]).toMatch(/^\u250a\s+│\s+│\s+\u250a$/u);
    expect(rows[at + 2]).toContain("wait");
  });
});

describe("a section label whose SPACES survive the rule under it", () => {
  const source =
    "sequenceDiagram\n    participant A\n    participant B\n    loop every minute\n        A->>B: ping\n" +
    "        alt is up\n            B-->>A: pong\n        else is down\n            B--xA: timeout\n" +
    "        end\n    end\n";

  it("writes the label as it was written, spaces and all", () => {
    const drawn = render(source, { width: 80 });
    expect(drawn).toContain("else | is down");
    expect(drawn).not.toMatch(/is┄down/u);
  });

  it("leaves the rule on either side of it, which is what says the section runs the width of the block", () => {
    const written = " else | is down ";
    const rule = must(render(source, { width: 80 })
      .split("\n")
      .find((row) => row.includes(written)));
    const at = rule.indexOf(written);
    expect(at).toBeGreaterThan(0);
    expect(rule.slice(0, at)).toContain("┄");
    expect(rule.slice(at + written.length)).toContain("┄");
  });
});

describe("a block's CONDITION folded onto the rows it needs, where the frame's side cut whatever ran past it", () => {
  const long =
    "sequenceDiagram\n    critical Establish a connection to the DB\n        Service-->DB: connect\n    end\n";
  const short = "sequenceDiagram\n    critical Connect\n        Service-->DB: connect\n    end\n";
  const rowsOf = (drawn: string): string[] => drawn.split("\n");
  const chipRows = (drawn: string, first: string): string[] => {
    const rows = rowsOf(drawn);
    const at = rows.findIndex((row) => row.includes(first));
    const held = [rows[at]];
    for (let r = at + 1; r < rows.length; r++) {
      if (!/[A-Za-z]/u.test((rows[r].match(/[┊:].*[┊:]/u) ?? [""])[0])) break;
      held.push(rows[r]);
    }
    return held;
  };

  it("writes the whole condition, on as many rows as the frame leaves it", () => {
    const drawn = render(long, { width: 60 });
    expect(drawn).toContain("critical | Establish a");
    expect(drawn).toContain("connection to the DB");
    expect(chipRows(drawn, "critical |")).toHaveLength(2);
  });

  it("pays for every row it folds out of the marker's OWN slot, so nothing under the rule is written over", () => {
    const folded = render(long, { width: 60 });
    expect(rowsOf(folded)).toHaveLength(rowsOf(render(short, { width: 60 })).length + 1);
    expect(folded).toContain("connect");
    expect(rowsOf(folded).filter((row) => row.includes("connect") && !row.includes("connection"))).toHaveLength(1);
  });

  it("keeps a condition that fits on the one row its rule already had", () => {
    expect(chipRows(render(short, { width: 60 }), "critical |")).toHaveLength(1);
  });

  it("lays the folded name on ONE rectangle, the lifelines under it covered on every row", () => {
    const drawn = render(long, { width: 60 });
    const [lid, second] = chipRows(drawn, "critical |");
    const lifeline = (must(rowsOf(drawn).find((row) => row.includes("└") && row.includes("│")))).indexOf("│");
    expect([...lid][lifeline]).not.toBe("│");
    expect([...second][lifeline]).not.toBe("│");
  });

  it("paints every row of that rectangle over the same columns, padding included", () => {
    const painted = renderThemed(long, { width: 60 }, "classic");
    const chip = painted.split("\n").map((row) => (row.match(/\[2;7;/gu) ?? []).length);
    const rows = chip.filter((count) => count > 0);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toBe(rows[1]);
  });

  it("folds a SECTION's own condition the same way, on the same frame", () => {
    const drawn = render(
      "sequenceDiagram\n    critical Connect\n        Service-->DB: connect\n" +
        "    option Network timeout is reached before the handshake completes\n" +
        "        Service-->Service: Log error\n    end\n",
      { width: 62 }
    );
    expect(drawn).toContain("completes");
    expect(chipRows(drawn, "option |").length).toBeGreaterThan(1);
  });

  it("cuts only where a single WORD is longer than the whole frame, which no fold can help", () => {
    const drawn = render(
      "sequenceDiagram\n    participant A\n    participant B\n    A->>B: hi\n" +
        "    loop Donaudampfschiffahrtselektrizitaetenhauptbetriebswerkbau\n        A->>B: tick\n    end\n",
      { width: 40 }
    );
    expect(drawn).toContain("Donaudampfschiffahrtsele");
    expect(drawn).not.toContain("betriebswerkbau");
    const floor = must(rowsOf(drawn).find((row) => row.includes("└┄")));
    for (const row of chipRows(drawn, "loop |")) expect(row.length).toBeLessThanOrEqual(floor.length);
  });
});
