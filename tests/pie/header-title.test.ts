import { describe, it, expect } from "vitest";
import { render } from "../../src/index.js";
import { parsePieChart } from "../../src/diagrams/piechart/parser.js";

describe("a pie title written on the header line, kept", () => {
  it("reads the title mermaid allows after the keyword", () => {
    expect(parsePieChart("pie title Where the time goes\n").title).toBe("Where the time goes");
  });

  it("reads it after showData too, which is the order mermaid writes them in", () => {
    const chart = parsePieChart('pie showData title Languages\n  "Go" : 30\n');
    expect(chart.title).toBe("Languages");
    expect(chart.showData).toBe(true);
  });

  it("puts the title in the drawing, not merely in the model", () => {
    expect(render('pie title Languages\n  "Go" : 30\n  "Rust" : 70\n', { width: 60 })).toContain("Languages");
  });

  it("leaves the two-line form alone", () => {
    expect(parsePieChart('pie\n    title Languages\n    "Go" : 30\n').title).toBe("Languages");
  });

  it("invents no title where the header carries none", () => {
    expect(parsePieChart('pie showData\n  "Go" : 30\n').title).toBe("");
  });
});
