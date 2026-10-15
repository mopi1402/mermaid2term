import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";
import { displayWidth } from "../../src/text/width.js";

// Two picks off main sent round past dev's own commits: each must leave its source by a lane of its own.
const FORK = ["gitGraph", '  commit id: "A"', '  commit id: "B"', "  branch dev", '  commit id: "C"', '  cherry-pick id: "A"', '  cherry-pick id: "B"'];
const PLAIN = ["gitGraph", '  commit id: "A"', "  branch dev", '  commit id: "C"', "  checkout main", '  commit id: "B"', '  commit id: "D"', "  checkout dev", '  commit id: "E"', '  cherry-pick id: "B"', '  cherry-pick id: "D"'];

const grid = (source: readonly string[], direction: string): string[][] =>
  render(source.join("\n").replace("gitGraph", `gitGraph ${direction}:`), { width: 120 })
    .split("\n")
    .map((line) => [...line].flatMap((ch) => (displayWidth(ch) > 1 ? [ch, ""] : [ch])));
// The row a commit's label opens.
const rowOf = (rows: string[][], word: string): number => rows.findIndex((line) => line.join("").trimStart().split(" ")[0] === word);
const corners = (cells: readonly string[]): number => cells.filter((ch) => ch === "╮" || ch === "╯").length;

describe("two cherry-picks sent round never share a lane", () => {
  it.each([
    ["off the fork point", FORK, ["A", "B"]],
    ["off two plain commits", PLAIN, ["B", "D"]],
  ])("LR, %s: a lane row for each pick, each dropping into its own cherry", (_, source, [first, second]) => {
    const rows = grid(source, "LR");
    const main = rows.findIndex((line) => line.join("").includes("main"));
    const dev = rows.findIndex((line) => line.join("").includes("dev"));
    const labels = rows[main + 1].join("");
    const [from, to] = [labels.indexOf(first), labels.indexOf(second)];
    const picks = rows[dev].flatMap((ch, col) => (ch === "🍒" ? [col] : []));
    const lanes = rows.slice(main + 2, dev - 1);
    expect(lanes).toHaveLength(2);
    // The later pick runs nearer main, from its own source to its own cherry.
    const [near, far] = lanes;
    expect(far[from]).toBe("╰");
    expect(far[picks[0]]).toBe("╮");
    expect(corners(far)).toBe(1);
    expect(["╰", "├"]).toContain(near[to]);
    expect(near[picks[1]]).toBe("╮");
    expect(corners(near)).toBe(1);
  });

  it.each([
    ["off the fork point", FORK, ["A", "B"]],
    ["off two plain commits", PLAIN, ["B", "D"]],
  ])("TB, %s: a lane column for each pick, each turning into its own cherry", (_, source, [first, second]) => {
    const rows = grid(source, "TB");
    const picks = rows.flatMap((line, row) => (line.includes("🍒") ? [row] : []));
    const lanes = picks.map((row) => rows[row].indexOf("╰"));
    expect(lanes[0]).toBeGreaterThan(0);
    expect(lanes[1]).toBeGreaterThan(0);
    expect(lanes[0]).not.toBe(lanes[1]);
    // Each lane leaves its own source's row and runs down past the source's label.
    [first, second].forEach((word, i) => {
      const source = rowOf(rows, word) - 1;
      expect(["╮", "┬"]).toContain(rows[source][lanes[i]]);
      expect(rows[source + 1][lanes[i]]).toBe("│");
    });
  });
});
