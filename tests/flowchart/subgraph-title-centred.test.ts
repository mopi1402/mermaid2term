import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";

const WALLS = /[│▏▕]/u;

// The blank columns either side of the title, counted to the frame's own walls on the title's row.
function gaps(drawing: string, title: string): [number, number] {
  const row = [...drawing.split("\n").find((line) => line.includes(` ${title} `)) ?? ""];
  const at = row.join("").indexOf(` ${title} `) + 1;
  let left = at - 1;
  while (left >= 0 && !WALLS.test(row[left])) left--;
  let right = at + title.length;
  while (right < row.length && !WALLS.test(row[right])) right++;
  return [at - left - 1, right - at - title.length];
}

// mermaid 12 centres a subgraph's title over its cluster rect, classic and neo looks alike (measured headless on
// 2026-09-29, `tmp/c4.html`), as it centres a composite state's name.
describe("a flowchart subgraph's title", () => {
  it.each(["TD", "LR"])("stands centred between the frame's walls (%s)", (direction) => {
    const drawing = render(`flowchart ${direction}\n  subgraph S [Title]\n    a[aaaaaaaaaaaaaaaa] --> b --> c\n  end\n`, { width: 80 });
    const [left, right] = gaps(drawing, "Title");
    expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
  });

  it.each(["TD", "LR"])("stands centred between a padless frame's walls (%s)", (direction) => {
    const drawing = render(`flowchart ${direction}\n  subgraph S [Title]\n    a[aaaaaaaaaaaaaaaa] --> b --> c\n  end\n`, { width: 80, borders: "padless" });
    const [left, right] = gaps(drawing, "Title");
    expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
  });
});
