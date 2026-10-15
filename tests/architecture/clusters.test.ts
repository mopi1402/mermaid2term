import { describe, it, expect } from "vitest";
import { renderThemedText } from "../../src/index.js";
import { HEADS } from "../../src/canvas/glyphs.js";
import { must } from "../../src/must.js";

const ARCHITECTURE = [
  "flowchart LR",
  "    subgraph Client",
  "        A[Browser]",
  "    end",
  "    subgraph Server",
  "        B[Load Balancer]",
  "        C[App Server 1]",
  "        D[App Server 2]",
  "    end",
  "    subgraph Data",
  "        E[(PostgreSQL)]",
  "        F[(Redis)]",
  "    end",
  "    Client --> Server",
  "    A --> B",
  "    B --> C",
  "    B --> D",
  "    C --> E",
  "    D --> E",
  "    C --> F",
  "    D --> F",
].join("\n");

const rows = (source: string, borders: "padless" | "default"): string[] =>
  renderThemedText(source, { width: 108, borders }, "default").plain.split("\n");

describe("an edge between two clusters rides no member's line (2026-09-11)", () => {
  it("moves `Client --> Server` onto a lane of its own above `A --> B`, under `padless` and `default` alike", () => {
    for (const borders of ["padless", "default"] as const) {
      const drawn = rows(ARCHITECTURE, borders);
      const browser = drawn.findIndex((r) => r.includes("Browser"));
      expect(drawn[browser]).toMatch(/Browser\s+[▕│├]─+⏵[▏│┤]\s+Load Balancer/u);
      expect(drawn[browser]).not.toContain("⏵─");
      expect(drawn[browser - 2]).toMatch(/[▕│├]─+⏵[▏│┤]/u);
      expect(drawn[browser - 1]).not.toContain("⏵");
    }
  });
});

describe("a drum in a five-row rank across the page, its runs arriving on its walls (2026-09-11)", () => {
  const drawn = rows(ARCHITECTURE, "padless");

  it("spans the rank, its name in its body a row above its foot as under `default`, a run on each body row", () => {
    const name = drawn.findIndex((r) => r.includes("PostgreSQL"));
    expect(drawn[name]).toContain("⏵⎜  PostgreSQL  ⎟");
    expect(drawn[name - 1]).toMatch(/App Server 1.*⏵⎜\s+⎟/u);
    expect(drawn[name + 1]).toContain("⎝▁▁▁▁▁▁▁▁▁▁▁▁▁▁⎠");
    expect(drawn[name - 2]).toContain("(▁▁▁▁▁▁▁▁▁▁▁▁▁▁)");
    expect(drawn[name - 3]).toMatch(/▁▁▁▁▁▁▁▁▁▁▁▁▁▁\s+▕$/u);
  });

  it("lands neither head on the lid nor on the feet, under `default` too", () => {
    expect(drawn.join("\n")).not.toMatch(/⏵[(⎝]/u);
    const plain = rows(ARCHITECTURE, "default").join("\n");
    expect(plain).not.toMatch(/⏵[(⎝]/u);
    expect(plain).toContain("⏵⎜  PostgreSQL  ⎟");
  });

  it("takes a head arriving from above INTO its hairline, the shaft stopping there, `▁▁▁⏷▁▁▁`", () => {
    const hairline = must(drawn.find((r) => /▁+⏷▁+/u.test(r)));
    expect(hairline).toBeDefined();
    const at = drawn.indexOf(hairline);
    expect(drawn[at + 1]).toContain("(▁▁▁▁▁▁▁▁▁▁▁▁▁▁)");
    expect(drawn[at + 2]).toMatch(/⏵⎜\s+⎟/u);
    expect(drawn[at + 3]).toContain("⎜    Redis     ⎟");
  });
});

describe("an edge between two clusters DOWN the page, a row apart, under `padless` (2026-09-22)", () => {
  // Both rules are inked on the INNER edge of their row here, so neither the run's start nor its head may take one:
  // the cell left of the ink is the frame's own inside, and a mark there reads as one dropped within the frame.
  it("leaves below the upper floor, runs the gap, and stands its head OFF the lower lid: `▁▁▁▁▁`, `│`, `⏷`, `▔▔▔▔▔`", () => {
    const drawn = rows(ARCHITECTURE.replace("flowchart LR", "flowchart TB").replace("    A --> B\n", ""), "padless");
    const lid = drawn.findIndex((r) => /^\s*▕▔+▏\s*$/u.test(r) && r.startsWith("▕"));
    expect(lid).toBeGreaterThan(2);
    expect(drawn[lid - 1]).toMatch(/^\s*⏷\s*$/u);
    expect(drawn[lid - 2]).toMatch(/^\s*│\s*$/u);
    expect(drawn[lid - 3]).toMatch(/^\s*▕▁+▏\s*$/u);
  });
});

const ARCHITECTURE_TB = ARCHITECTURE.replace("flowchart LR", "flowchart TB")
  .replace("    A --> B\n", "    A --> B\n    Server --> F\n    D <--> Data\n");

describe("two edges are NEVER one line, and a head never eats its corner: `Server --> F` beside `D <--> Data` down the page (2026-09-11)", () => {
  it("draws no junction under `padless`, where `├ ┤ ┬ ┴` can only be two runs melted into one", () => {
    const drawn = renderThemedText(ARCHITECTURE_TB, { width: 120, borders: "padless" }, "default").plain;
    expect(drawn).not.toMatch(/[├┤┬┴]/u);
  });

  it("leaves a clear cell between `Client --> Server` and `A --> B` where both cross the Client frame's rule, `▔│▔│▔` and never `││`", () => {
    const drawn = rows(ARCHITECTURE_TB, "padless");
    expect(drawn.some((r) => /^\s*│ │\s*$/u.test(r))).toBe(true);
    expect(drawn.some((r) => r.includes("││"))).toBe(false);
  });

  it("feeds every head straight, `──╮` over `⏷` into Redis and never `───⏷`", () => {
    for (const borders of ["padless", "default"] as const) {
      const drawn = rows(ARCHITECTURE_TB, borders).map((r) => [...r]);
      const at = (r: number, c: number): string => drawn[r]?.[c] ?? " ";
      drawn.forEach((row, r) =>
        row.forEach((g, c) => {
          const feed = HEADS.get(g);
          if (feed === undefined) return;
          const behind = at(r + feed.dr, c + feed.dc);
          expect(feed.allowed.has(behind), `${borders}: head ${g} at line ${r + 1}, column ${c + 1} is fed by '${behind}'`).toBe(true);
        })
      );
    }
  });
});

const ARCHITECTURE_TWO_WAY = ARCHITECTURE_TB.replace("    D <--> Data\n", "    D <--> Data\n    Server <--> Data\n    A --> C\n    A --> E\n");

const FRAMES_TWO_WAY = [
  "flowchart TB",
  "    subgraph Upper",
  "        A[one]",
  "    end",
  "    subgraph Lower",
  "        B[two]",
  "    end",
  "    Upper <--> Lower",
  "    Lower <--> A",
].join("\n");

const behindHeads = (drawn: string[][], head: string): string[] => {
  const { dr, dc } = must(HEADS.get(head));
  const out: string[] = [];
  drawn.forEach((row, r) => row.forEach((g, c) => g === head && out.push(drawn[r + dr]?.[c + dc] ?? " ")));
  return out;
};

describe("a run is NEVER cut behind its head: a two-headed edge between two frames, `Server <--> Data` down the page, draws `⏶`, its shaft, `⏷` with no blank between (2026-09-11)", () => {
  it("under `padless`, a start head stands OFF the rule it leaves by and its shaft follows on the very next row, `⏶` over `│`, never over a blank", () => {
    const drawn = rows(ARCHITECTURE_TWO_WAY, "padless").map((r) => [...r]);
    const rule = drawn.findIndex((row) => row.includes("⏶"));
    expect(rule).toBeGreaterThan(0);
    expect(drawn[rule]?.includes("▁")).toBe(false);
    const c = drawn[rule]?.indexOf("⏶");
    expect(drawn[rule + 1]?.[c]).toBe("│");
    for (const head of ["⏶", "⏷"]) for (const fed of behindHeads(drawn, head)) expect(fed).not.toBe(" ");
  });

  it("under `default`, the band between two frames holds a row for the shaft between the two heads, `⏶ │ ⏷` and never `⏶⏷`", () => {
    for (const source of [ARCHITECTURE_TWO_WAY, FRAMES_TWO_WAY]) {
      const drawn = rows(source, "default").map((r) => [...r]);
      const up = drawn.findIndex((row, r) => row.includes("⏶") && /└.*┘\s*$/u.test((drawn[r - 1] ?? []).join("")));
      expect(up, `${source.slice(0, 12)}: a ⏶ under a frame floor`).toBeGreaterThan(0);
      const c = drawn[up]?.indexOf("⏶");
      expect(drawn[up + 1]?.[c], `${source.slice(0, 12)}: under the ⏶`).toBe("│");
      expect(drawn[up + 2]?.[c]).toMatch(/[│⏷]/u);
    }
  });

  it("feeds every head straight in both modes, the two-way run included", () => {
    for (const borders of ["padless", "default"] as const) {
      const drawn = rows(ARCHITECTURE_TWO_WAY, borders).map((r) => [...r]);
      drawn.forEach((row, r) =>
        row.forEach((g, c) => {
          const feed = HEADS.get(g);
          if (feed === undefined) return;
          const behind = drawn[r + feed.dr]?.[c + feed.dc] ?? " ";
          expect(feed.allowed.has(behind), `${borders}: head ${g} at line ${r + 1}, column ${c + 1} is fed by '${behind}'`).toBe(true);
        })
      );
    }
  });
});
