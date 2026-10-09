import { describe, it, expect } from "vitest";
import { parseJourney } from "../../src/diagrams/journey/parser.js";

describe("\u25c9 a journey score stays inside mermaid's bounds, 1 to 5 inclusive", () => {
  it("pulls an overshoot down to 5 and an undershoot up to 1", () => {
    const journey = parseJourney(
      "journey\n  section S\n    Haut: 8: Moi\n    Bas: 0: Moi\n    Negatif: -3: Moi\n    Cinq: 5: Moi\n    Un: 1: Moi",
    );
    expect(journey.sections[0]?.tasks.map((task) => task.score)).toEqual([5, 1, 1, 5, 1]);
  });

  it("leaves the default of 3 standing where the score is not a whole number", () => {
    const journey = parseJourney("journey\n  section S\n    Flou: haut: Moi\n    Creux: : Moi");
    expect(journey.sections[0]?.tasks.map((task) => task.score)).toEqual([3, 3]);
  });
});
