import { describe, it, expect } from "vitest";
import { render, renderThemed } from "../../src/index.js";
import { must } from "../../src/must.js";
import { runsOf, stripSgr } from "../support/ansi.js";

describe("a nested block FRAMED around what it holds, where it used to be drawn around every participant there is", () => {
  const nested =
    "sequenceDiagram\n    par Alice to Bob\n        Alice->>Bob: go\n    and Alice to John\n" +
    "        Alice->>John: today\n        par John to Charlie\n            John->>Charlie: can we\n" +
    "        and John to Diana\n            John->>Diana: can you\n        end\n    end\n";
  const rowOf = (drawn: string, mark: string): string =>
    must(drawn.split("\n").find((line) => line.includes(mark)));
  const lidOf = (drawn: string, mark: string): [number, number] => {
    const row = rowOf(drawn, mark);
    return [row.indexOf("┌"), row.lastIndexOf("┐")];
  };
  const columnOfName = (drawn: string, name: string): number =>
    rowOf(drawn, name).indexOf(name) + Math.floor(name.length / 2);

  it("opens the inner frame near the first participant it speaks to and not at the drawing's edge", () => {
    const drawn = render(nested, { width: 100 });
    const [innerLeft] = lidOf(drawn, "par | John to Charlie");
    expect(innerLeft).toBeGreaterThan(columnOfName(drawn, "Bob"));
    expect(innerLeft).toBeLessThan(columnOfName(drawn, "John"));
    expect(lidOf(drawn, "par | Alice to Bob")[0]).toBeLessThan(columnOfName(drawn, "Alice"));
  });

  it("keeps a nested frame strictly INSIDE the one around it, on both sides", () => {
    const drawn = render(nested, { width: 100 });
    const [outerLeft, outerRight] = lidOf(drawn, "par | Alice to Bob");
    const [innerLeft, innerRight] = lidOf(drawn, "par | John to Charlie");
    expect(innerLeft).toBeGreaterThan(outerLeft);
    expect(innerRight).toBeLessThan(outerRight);
  });

  it("hangs a section's rule on the very frame its own block was drawn at", () => {
    const drawn = render(nested, { width: 100 });
    for (const [block, section] of [
      ["par | John to Charlie", "and | John to Diana"],
      ["par | Alice to Bob", "and | Alice to John"],
    ]) {
      const [left, right] = lidOf(drawn, block);
      const cells = [...rowOf(drawn, section)];
      expect([cells[left], cells[right]]).toEqual(["┊", "┊"]);
    }
  });

  it("reaches around what a SECTION holds too, a branch speaking further than the first one", () => {
    const drawn = render(
      "sequenceDiagram\n    participant A\n    participant B\n    participant C\n    participant D\n" +
        "    A->>D: opening\n    alt near\n        A->>B: short\n    else far\n        A->>D: long\n    end\n",
      { width: 90 }
    );
    expect(lidOf(drawn, "alt | near")[1]).toBeGreaterThan(columnOfName(drawn, "D"));
  });

  it("reaches around a self-message's LOOP, which is drawn out to the right of its own lifeline", () => {
    const drawn = render(
      "sequenceDiagram\n    participant A\n    participant B\n    A->>B: hi\n" +
        "    opt maybe\n        B->>B: thinks it over\n    end\n",
      { width: 90 }
    );
    const loop = rowOf(drawn, "─╮");
    expect(lidOf(drawn, "opt | maybe")[1]).toBeGreaterThan(loop.lastIndexOf("╮"));
  });

  it("reaches around a note hanging off the LAST lifeline, which no column of its own says where it ends", () => {
    const drawn = render(
      "sequenceDiagram\n    participant A\n    participant B\n    alt yes\n        A->>B: go\n" +
        "        Note right of B: a note hanging off the edge\n    end\n",
      { width: 90 }
    );
    expect(lidOf(drawn, "alt | yes")[1]).toBeGreaterThan(rowOf(drawn, "a note hanging").lastIndexOf("│"));
  });

  it("gives a frame back the width its own NAME asks for, up to the whole width and no further", () => {
    const drawn = render(
      "sequenceDiagram\n    participant A\n    participant B\n    participant C\n    participant D\n" +
        "    A->>D: wide one\n    loop every fifteen minutes until the queue drains\n        B->>C: tick\n    end\n",
      { width: 100 }
    );
    expect(drawn).toContain("loop | every fifteen minutes until the queue drains");
    const floor = rowOf(drawn, "└┄");
    expect(lidOf(drawn, "loop |")).toEqual([floor.indexOf("└"), floor.lastIndexOf("┘")]);
    expect(floor.indexOf("└")).toBeLessThan(columnOfName(drawn, "A"));
  });

  it("holds a nested frame its own NAME widened, which the block around it never spoke that far to reach", () => {
    const drawn = render(
      "sequenceDiagram\n    participant A\n    participant B\n    participant C\n    participant D\n" +
        "    A->>D: opening\n    opt narrow\n        A->>B: near\n" +
        "        loop every fifteen minutes until the queue drains\n            B->>C: tick\n        end\n    end\n",
      { width: 100 }
    );
    const [outerLeft, outerRight] = lidOf(drawn, "opt | narrow");
    const [innerLeft, innerRight] = lidOf(drawn, "loop | every fifteen");
    expect(innerLeft).toBeGreaterThan(outerLeft);
    expect(innerRight).toBeLessThan(outerRight);
  });

  it("keeps the whole width for a block that holds nothing to be drawn around", () => {
    const drawn = render(
      "sequenceDiagram\n    participant A\n    participant B\n    A->>B: hi\n    loop nothing inside\n    end\n",
      { width: 70 }
    );
    const floor = rowOf(drawn, "└┄");
    expect(lidOf(drawn, "loop | nothing inside")).toEqual([floor.indexOf("└"), floor.lastIndexOf("┘")]);
    expect(floor.lastIndexOf("┘")).toBeGreaterThan(columnOfName(drawn, "B"));
  });

  it("keeps each level of nesting apart where what they hold sits flush against the left edge", () => {
    const drawn = render(
      "sequenceDiagram\n    participant A\n    participant B\n    loop every minute\n        A->>B: ping\n" +
        "        alt is up\n            B-->>A: pong\n        end\n    end\n",
      { width: 60 }
    );
    expect(lidOf(drawn, "loop | every minute")[0]).toBe(0);
    expect(lidOf(drawn, "alt | is up")[0]).toBe(2);
  });
});

describe("a block's cartouche kept WHOLE over a box's fill, where the band came apart between its words", () => {
  const cells = (drawn: string, word: string): Array<readonly [string, string]> => {
    const row = drawn.split("\n").find((line) => stripSgr(line).includes(word));
    expect(row).toBeDefined();
    return runsOf(must(row)).flatMap(([codes, text]) => [...text].map((ch) => [ch, codes] as const));
  };
  const WRITTEN = " loop | every minute ";
  const tab = (drawn: string): Array<readonly [string, string]> => {
    const row = cells(drawn, "loop");
    const at = row.map(([ch]) => ch).join("").indexOf(WRITTEN);
    expect(at).toBeGreaterThanOrEqual(0);
    return row.slice(at, at + WRITTEN.length);
  };
  const block = "    loop every minute\n        M->>S: Ping\n    end\n";
  const inside =
    "sequenceDiagram\n    box grey G\n    participant M\n    participant S\n    end\n" + block;
  const outside = "sequenceDiagram\n    participant M\n    participant S\n" + block;

  it("paints every cell of the tab alike, the spaces between its words included", () => {
    for (const theme of ["classic", "neon", "mono"]) {
      const run = tab(renderThemed(inside, { width: 50 }, theme));
      expect(run.map(([ch]) => ch).join("")).toBe(WRITTEN);
      const codes = new Set(run.map(([, code]) => code));
      expect(codes.size).toBe(1);
    }
  });

  it("paints it the same inside a filled box as outside one, the swap being its own ground", () => {
    for (const theme of ["classic", "neon", "mono"]) {
      expect(tab(renderThemed(inside, { width: 50 }, theme))).toEqual(
        tab(renderThemed(outside, { width: 50 }, theme)),
      );
    }
  });
});
