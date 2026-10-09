import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { render } from "../../src/index.js";
import { Canvas } from "../../src/canvas/canvas.js";
import { must } from "../../src/must.js";
import { join } from "node:path";

describe("boxes running across the flow hung from one line, not each from the bottom of the last", () => {
  const source = `flowchart
    subgraph Intake
        direction TD
        A[PagerDuty sev-1] --> B[Normalize signal]
        B --> C{Correlate alerts?}
    end
    subgraph Analysis
        direction TD
        C -->|valid| D[Assemble incident room]
        C -->|noise| E[Close alert]
        D --> F{Mitigation path}
    end
    subgraph Response
        direction TD
        F -->|automate| G[Run edge traffic shift]
        F -->|coordinate| H[Page platform + product leads]
        G --> I[Validate latency and error budgets]
        H --> I
    end
    subgraph Learning
        direction TD
        I --> J[Capture incident timeline]
        J --> K[Publish corrective actions]
    end`;

  it("hangs the four boxes from one line at width 200, every head kept and none turned up", () => {
    const drawn = render(source, { width: 200 });
    const labels = must(drawn.split("\n").find((row) => row.includes("Intake")));
    for (const box of ["Analysis", "Response", "Learning"]) expect(labels).toContain(box);
    expect((drawn.match(/[⏶⏷⏴⏵]/gu) ?? []).length).toBe(11);
    expect(drawn).not.toContain("⏶");
    expect(drawn.split("\n").length).toBeLessThanOrEqual(40);
  });
});

describe("a chain of fans held to the tracks the drawing already pays for, no escalier of columns", () => {
  const source = `flowchart
    subgraph Intake
        A[PagerDuty sev-1] --> B[Normalize signal]
        B --> C{Correlate alerts?}
    end
    subgraph Analysis
        C -->|valid| D[Assemble incident room]
        C -->|noise| E[Close alert]
        D --> F{Mitigation path}
    end
    subgraph Response
        F -->|automate| G[Run edge traffic shift]
        F -->|coordinate| H[Page platform + product leads]
        G --> I[Validate latency and error budgets]
        H --> I
    end
    subgraph Learning
        I --> J[Capture incident timeline]
        J --> K[Publish corrective actions]
    end`;

  it.each([[40], [80]])("draws the chain on three tracks at width %d, every head kept", (width) => {
    const drawn = render(source, { width });
    expect(Math.max(...drawn.split("\n").map((l) => l.length))).toBeLessThanOrEqual(76);
    expect((drawn.match(/[⏶⏷⏴⏵]/gu) ?? []).length).toBe(11);
  });
});

describe("aggressive compaction: past three, an identical stroke run is waste", () => {
  const grid = (drawn: string): string[][] => {
    const rows = drawn.split("\n").map((line) => [...line]);
    const width = Math.max(...rows.map((row) => row.length));
    return rows.map((row) => row.concat(Array.from({ length: width - row.length }, () => " ")));
  };
  const runOf = (lanes: string[][], strokes: ReadonlySet<string>): number => {
    let longest = 0;
    let run = 0;
    let prev: string | undefined;
    for (const lane of lanes) {
      const pure = lane.every((ch) => ch === " " || strokes.has(ch)) && lane.some((ch) => ch !== " ");
      const sig = pure ? lane.join("") : undefined;
      run = sig !== undefined && sig === prev ? run + 1 : sig !== undefined ? 1 : 0;
      prev = sig;
      longest = Math.max(longest, run);
    }
    return longest;
  };
  const V = new Set([..."│┃\u250a"]);
  const H = new Set([..."─━┄"]);
  const rowRun = (drawn: string): number => runOf(grid(drawn), V);
  const colRun = (drawn: string): number => {
    const g = grid(drawn);
    const cols = g[0].map((_, c) => g.map((row) => row[c]));
    return runOf(cols, H);
  };

  it("holds every drawing of the lifecycle and the crossing fan to three, at every width", () => {
    for (const width of [40, 60, 80, 120]) {
      const fan = render(readFileSync(join(import.meta.dirname, "..", "..", "fixtures", "flowchart", "crossing.mmd"), "utf8"), { width });
      expect(rowRun(fan)).toBeLessThanOrEqual(3);
      expect(colRun(fan)).toBeLessThanOrEqual(3);
      const life = render(
        readFileSync(join(import.meta.dirname, "..", "..", "fixtures", "state", "change-lifecycle.mmd"), "utf8"),
        { width }
      );
      expect(rowRun(life)).toBeLessThanOrEqual(3);
    }
  });

  it("never cuts below three: a run of five identical stroke rows keeps a full three", () => {
    const canvas = new Canvas(5, 9);
    canvas.put(0, 2, "┬", false);
    for (let r = 1; r <= 7; r++) canvas.put(r, 2, "│", false);
    canvas.put(8, 2, "⏷", false);
    canvas.compactRuns(3, 3);
    expect(rowRun(canvas.toString())).toBe(3);
  });
});
