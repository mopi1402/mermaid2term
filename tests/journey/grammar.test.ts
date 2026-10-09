import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";
import { parseJourney } from "../../src/diagrams/journey/parser.js";
import { NEWLINE } from "../../src/text/chars.js";

const WIDTHS = [40, 120];

describe("journey statements read as mermaid's lexer cuts them", () => {
  it("ends a task at `#`, mermaid's comment rule", () => {
    const journey = parseJourney("journey\n  title Day # aside\n  section Morning # aside\n    Coffee: 2: Me # note");
    expect(journey.title).toBe("Day");
    expect(journey.sections[0].title).toBe("Morning");
    expect(journey.sections[0].tasks).toEqual([{ title: "Coffee", score: 2, actors: ["Me"] }]);
    for (const width of WIDTHS) {
      const out = render("journey\n  section Morning\n    Coffee: 2: Me # note\n", { width });
      expect(out).toContain("● Me");
      expect(out).not.toContain("note");
    }
  });

  it("draws nothing for a section with no task, the header row whole", () => {
    const empty = "journey\n  section A\n    a: 3: Me\n  section Empty\n  section B\n    b: 4: Me\n";
    const without = "journey\n  section A\n    a: 3: Me\n  section B\n    b: 4: Me\n";
    for (const width of WIDTHS) {
      const out = render(empty, { width });
      expect(out).not.toContain("Empty");
      expect(out).toBe(render(without, { width }));
      expect(out.split(NEWLINE)[0]).toMatch(/╭─+ A ─+╮ ╭─+ B ─+╮/u);
    }
  });

  it("draws the title alone when no section holds a task", () => {
    for (const width of WIDTHS) {
      expect(render("journey\n  title Day\n  section Empty\n", { width }).trim()).toBe("Day");
      expect(render("journey\n  title Day\n", { width }).trim()).toBe("Day");
    }
  });
});

describe("a statement written on the journey's header line", () => {
  it("reads it as mermaid's lexer does, past the keyword", () => {
    const source = "journey title Day out\n  section Go\n    Tea: 5: Me\n";
    expect(parseJourney(source).title).toBe("Day out");
    expect(parseJourney("journey section Go\n    Tea: 5: Me\n").sections.map((section) => section.title)).toEqual(["Go"]);
    for (const width of WIDTHS) expect(render(source, { width }), `width ${width}`).toContain("Day out");
  });
});
