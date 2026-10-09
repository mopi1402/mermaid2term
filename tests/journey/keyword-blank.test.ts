import { describe, expect, it } from "vitest";
import { parseJourney } from "../../src/diagrams/journey/parser.js";

describe("journey's `title\\s` and `section\\s` take any one blank after the keyword, a tab included", () => {
  it("a tab after `title`", () => {
    expect(parseJourney("journey\n  title\tTabbed\n  section s\n    t: 5: Me\n").title).toBe("Tabbed");
  });

  it("a tab after `section`", () => {
    expect(parseJourney("journey\n  section\tWork\n    t: 5: Me\n").sections.map((one) => one.title)).toEqual(["Work"]);
  });

  it("a word that only starts with the keyword is no title", () => {
    expect(parseJourney("journey\n  titles: 5: Me\n").title).toBe("");
  });
});
