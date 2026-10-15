import { describe, it, expect } from "vitest";
import { render, renderThemed } from "../../src/index.js";
import { must } from "../../src/must.js";
import { getTheme } from "../../src/paint/catalogue.js";
import { parseHex } from "../../src/colour/rgb.js";
import { withConfig } from "../support/frontmatter.js";
import { ESC } from "../../src/paint/escapes.js";

describe("a `rect` painted as the GROUND it is, where it was drawn as a dashed frame naming its own colour", () => {
  const nested =
    "sequenceDiagram\n    participant Alice\n    participant John\n    rect rgb(191, 223, 255)\n" +
    "    Alice->>John: outer\n    rect rgb(200, 150, 255)\n    Alice->>John: inner\n    end\n    end\n";
  const groundsOf = (painted: string, at: number): string[] =>
    ((painted.split("\n")[at]) ?? "").split(ESC).flatMap((run) => {
      const found = /^\[([0-9;:]*)m(.*)$/u.exec(run) ?? undefined;
      if (found === undefined) return [];
      const ground = /48;2;(\d+;\d+;\d+)/u.exec(found[1]) ?? undefined;
      return [...(found[2])].map(() => (ground === undefined ? "" : (ground[1])));
    });
  const inkOf = (painted: string, word: string): string => {
    for (const run of painted.split(ESC)) {
      const found = /^\[([0-9;:]*)m(.*)$/u.exec(run) ?? undefined;
      if (found !== undefined && found[2].includes(word)) return found[1];
    }
    throw new Error(`aucun ${word} peint dans cette prise`);
  };
  const rowOfWord = (drawn: string, word: string): number => drawn.split("\n").findIndex((row) => row.includes(word));

  it("draws no rule and writes no name, the colour being the whole of what it says", () => {
    const drawn = render(nested, { width: 60 });
    expect(drawn).not.toContain("rect");
    expect(drawn).not.toContain("rgb(");
    expect(drawn).not.toMatch(/[┌┐└┘]┄/u);
  });

  it("lays the colour under every cell of its slab, the blanks included", () => {
    const painted = renderThemed(nested, { width: 60 }, "classic");
    const grounds = groundsOf(painted, rowOfWord(render(nested, { width: 60 }), "outer"));
    expect(grounds.length).toBeGreaterThan(20);
    expect(new Set(grounds)).toEqual(new Set(["191;223;255"]));
  });

  const lone =
    "sequenceDiagram\n    participant Alice\n    participant John\n    rect rgb(191, 223, 255)\n" +
    "    Alice->>John: hi\n    end\n";
  const columnGroundsOf = (painted: string, at: number): string[] => {
    const row = (painted.split("\n")[at]) ?? "";
    const out: string[] = [];
    let ground = "";
    for (const [which, part] of row.split(ESC).entries()) {
      let text = part;
      if (which === 0) ground = "";
      else {
        const found = /^\[([0-9;:]*)m/u.exec(part) ?? undefined;
        if (found !== undefined) {
          const seen = /48;2;(\d+;\d+;\d+)/u.exec(found[1]) ?? undefined;
          ground = seen === undefined ? "" : (seen[1]);
          text = part.slice(found[0].length);
        }
      }
      for (const _ of [...text]) out.push(ground);
    }
    return out;
  };
  const slabOf = (source: string, ground: string): [number, number] => {
    const painted = renderThemed(source, { width: 60 }, "classic");
    let held: [number, number] = [0, -1];
    painted.split("\n").forEach((_, at) => {
      const grounds = columnGroundsOf(painted, at);
      const first = grounds.indexOf(ground);
      if (first === -1) return;
      const last = grounds.lastIndexOf(ground);
      if (last - first > held[1] - held[0]) held = [first, last];
    });
    return held;
  };
  const lifelinesOf = (source: string): number[] => {
    const rows = render(source, { width: 60 }).split("\n");
    const at = rows.findIndex((row) => row.includes("╰"));
    return [...((rows[at + 1]) ?? "")].flatMap((cell, col) => (cell === "│" ? [col] : []));
  };

  it("reaches ONE column past the lifelines it covers, where a frame reaches six", () => {
    const lifelines = lifelinesOf(lone);
    const [left, right] = slabOf(lone, "191;223;255");
    expect(left).toBe((lifelines[0]) - 1);
    expect(right).toBe((lifelines[lifelines.length - 1]) + 1);
  });

  it("reaches PAST the last lifeline, a blank it is seated on being part of the slab and not a tail", () => {
    const lifelines = lifelinesOf(lone);
    expect(slabOf(lone, "191;223;255")[1]).toBeGreaterThan(lifelines[lifelines.length - 1]);
  });

  it("clears a nested slab by a column, so the one around it is seen at all", () => {
    const [outerLeft, outerRight] = slabOf(nested, "191;223;255");
    const [innerLeft, innerRight] = slabOf(nested, "200;150;255");
    expect(innerLeft - outerLeft).toBe(1);
    expect(outerRight - innerRight).toBe(1);
  });

  it("covers the same columns on every one of its rows", () => {
    const painted = renderThemed(nested, { width: 60 });
    const widths = painted
      .split("\n")
      .map((_, at) => groundsOf(painted, at))
      .filter((grounds) => grounds.includes("191;223;255"))
      .map((grounds) => grounds.length);
    expect(widths.length).toBeGreaterThan(1);
    expect(new Set(widths).size).toBe(1);
  });

  it("opens on a blank ROW of its own and pays for no other, the rest being its contents' own rows", () => {
    const held =
      "sequenceDiagram\n    participant A\n    participant B\n    A->>B: before\n" +
      "    rect rgb(191, 223, 255)\n    A->>B: inside\n    end\n    A->>B: after\n";
    const bare = "sequenceDiagram\n    participant A\n    participant B\n    A->>B: before\n    A->>B: inside\n    A->>B: after\n";
    // mermaid bumps its cursor by `boxMargin` where a `rect` opens (`RECT_START` in its renderer), so the fill
    // breathes above the first label instead of starting on the words; the arrow's row gives the air below.
    expect(render(held, { width: 50 }).split("\n")).toHaveLength(render(bare, { width: 50 }).split("\n").length + 1);
    const painted = renderThemed(held, { width: 50 }, "classic");
    const covered = painted
      .split("\n")
      .filter((_, at) => columnGroundsOf(painted, at).includes("191;223;255"));
    expect(covered).toHaveLength(3);
    expect(covered[0]).not.toContain("inside");
    expect(covered[1]).toContain("inside");
  });

  it("covers the WALLS of a participant box it runs across, keeping the lifelines drawn over it", () => {
    const held =
      "sequenceDiagram\n    box Purple Front\n    participant A\n    participant B\n    end\n    participant C\n" +
      "    B->>C: before\n    rect rgb(191, 223, 255)\n    A->>C: inside\n    end\n";
    // mermaid lowers a `box` under the ground a `rect` draws, so the ground hides the walls it runs across; the
    // lifelines and the message, drawn over both, keep their cells.
    for (const [borders, wallGlyph] of [["default", "║"], ["padless", "▕"]] as const) {
      const rows = render(held, { width: 60, borders }).split("\n");
      const at = rows.findIndex((row) => row.includes("inside"));
      const below = must(rows[at + 3]);
      const wall = below.lastIndexOf(wallGlyph);
      const lifeline = below.indexOf("│");
      expect(wall).toBeGreaterThan(lifeline);
      for (const row of [must(rows[at - 1]), must(rows[at])]) {
        expect(row[wall], borders).toBe(" ");
        expect(row[lifeline], borders).toBe("│");
      }
      // The shaft runs unbroken where it used to be notched by the wall it crossed.
      expect(must(rows[at + 1]), borders).not.toContain("╫");
    }
  });

  it("reaches down over a note it holds last, which is drawn deeper than a message's slot", () => {
    const held =
      "sequenceDiagram\n    participant A\n    participant B\n    rect rgb(191, 223, 255)\n    A->>B: inside\n" +
      "    Note over A,B: a note last\n    end\n    A->>B: after\n";
    const painted = renderThemed(held, { width: 50 }, "classic");
    const covered = painted
      .split("\n")
      .filter((_, at) => columnGroundsOf(painted, at).includes("191;223;255"));
    expect(covered).toHaveLength(6);
    expect(covered.some((row) => row.includes("after"))).toBe(false);
  });

  it("seats a nested rect's own colour OVER the one around it", () => {
    const drawn = render(nested, { width: 60 });
    const painted = renderThemed(nested, { width: 60 }, "classic");
    const inner = groundsOf(painted, rowOfWord(drawn, "inner"));
    expect(inner.filter((ground) => ground === "200;150;255").length).toBeGreaterThan(inner.length / 2);
    expect(inner).toContain("191;223;255");
    expect(new Set(groundsOf(painted, rowOfWord(drawn, "outer")))).toEqual(new Set(["191;223;255"]));
  });

  it("keeps a cell's own ink under a nested slab, the band being REPLACED and never stacked", () => {
    const painted = renderThemed(nested, { width: 60 }, "classic");
    expect(painted).toMatch(/\[3;38;2;\d+;\d+;\d+;48;2;200;150;255m/u);
  });

  it("asks an ink whether it can be READ on that colour before laying it there", () => {
    const painted = renderThemed(nested, { width: 60 }, "classic");
    const plain = renderThemed(
      "sequenceDiagram\n    participant Alice\n    participant John\n    Alice->>John: outer\n",
      { width: 60 },
      "classic"
    );
    expect(inkOf(painted, "u")).not.toBe(inkOf(plain, "u"));
  });

  it("leaves a note its OWN ground, which the slab is laid under and not over", () => {
    const painted = renderThemed(
      "sequenceDiagram\n    participant Alice\n    participant John\n    rect rgb(191, 223, 255)\n" +
        "    Note right of Alice: Alice calls John.\n    Alice->>John: hi\n    end\n",
      { width: 60 },
      "classic"
    );
    expect(painted).toContain("48;2;255;214;51");
  });

  it("paints a `rect` that names no colour on the theme's `rectBkgColor`, `tertiaryColor` when unwritten, as mermaid does", () => {
    const body = "sequenceDiagram\n    participant A\n    participant B\n    rect\n    A->>B: hi\n    end\n";
    const row = rowOfWord(render(body, { width: 50 }), "hi");
    const tertiary = must(parseHex(must(getTheme("default").variables.tertiaryColor).toLowerCase()));
    expect(groundsOf(renderThemed(body, { width: 50, background: "light" }, "default"), row)).toContain(`${tertiary.r};${tertiary.g};${tertiary.b}`);
    const written = withConfig({ themeVariables: { rectBkgColor: '"#ffd6d6"' } }, body);
    expect(groundsOf(renderThemed(written, { width: 50, background: "light" }, "default"), row)).toContain("255;214;214");
  });

  it("paints nothing at all where the author asked for `transparent`", () => {
    const source =
      "sequenceDiagram\n    participant A\n    participant B\n    rect transparent\n    A->>B: hi\n    end\n";
    const painted = renderThemed(source, { width: 50 }, "classic");
    expect(groundsOf(painted, rowOfWord(render(source, { width: 50 }), "hi"))).not.toContain("64;64;64");
    expect(painted).not.toContain("transparent");
  });

  it("asks the drawing for neither a column nor a row to write a name it never writes", () => {
    const bare = render("sequenceDiagram\n    participant A\n    participant B\n    rect\n    A->>B: hi\n    end\n", {
      width: 50,
    });
    const named = render(
      "sequenceDiagram\n    participant A\n    participant B\n    rect rgb(191, 223, 255)\n    A->>B: hi\n    end\n",
      { width: 50 }
    );
    expect(named).toBe(bare);
  });
});
