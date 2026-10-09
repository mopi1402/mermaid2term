import { describe, it, expect } from "vitest";
import { NEWLINE } from "../../src/text/chars.js";
import { parseTimeline } from "../../src/diagrams/timeline/parser.js";
import { renderTimelineVertical } from "../../src/diagrams/timeline/render.js";

const down = (source: string, budget?: number): string[] =>
  renderTimelineVertical(parseTimeline(source), undefined, budget).toString().split(NEWLINE).map((row) => row.trimEnd());

describe("a period on several lines drawn down stands apart from its first event", () => {
  it("leaves one bare trunk row between the period's last line and its first event", () => {
    expect(down("timeline TD\n  Early planning<br>and budget : Kickoff : Staffing\n  Review : Done\n")).toEqual([
      " ●── Early planning",
      " │   and budget",
      " │",
      " │   Kickoff",
      " │   Staffing",
      " │",
      " ●── Review",
      " │   Done",
    ]);
  });

  it("parts a period the budget folds the same way", () => {
    const rows = down("timeline TD\n  Long planning period that folds : Launch\n", 24);
    const event = rows.findIndex((row) => row.includes("Launch"));
    expect(rows.findIndex((row) => row.includes("●──"))).toBeLessThan(event - 2);
    expect(rows[event - 1]).toBe(" │");
    expect(rows[event - 2]).not.toBe(" │");
  });

  it("keeps a one-line period on the row right above its event, and a period with no event unspaced", () => {
    expect(down("timeline TD\n  2024 : Kickoff\n  Solo<br>period\n")).toEqual([" ●── 2024", " │   Kickoff", " │", " ●── Solo", " │   period"]);
  });
});
