import { describe, it, expect } from "vitest";
import { parseSequenceDiagram, renderSequence } from "../../src/index.js";
import { must } from "../../src/must.js";

describe("folding for a width budget leaves the parsed diagram untouched, so rendering it twice draws the same thing", () => {
  const label = "a rather long message label that has to be folded to fit inside the budget";
  const text = "a note with enough words in it that the fold has to break it across several lines";
  const source =
    "sequenceDiagram\n    participant A as Alice\n    participant B as Bob\n" +
    `    A->>B: ${label}\n    Note over A,B: ${text}\n`;
  const budget = 40;

  it("draws the same output on the second render as on the first", () => {
    const diagram = parseSequenceDiagram(source);
    const first = renderSequence(diagram, undefined, undefined, undefined, budget).toString();
    const second = renderSequence(diagram, undefined, undefined, undefined, budget).toString();
    expect(second).toBe(first);
  });

  it("draws an unfolded diagram after a folded one exactly as a fresh parse would", () => {
    const diagram = parseSequenceDiagram(source);
    renderSequence(diagram, undefined, undefined, undefined, budget);
    const after = renderSequence(diagram).toString();
    const fresh = renderSequence(parseSequenceDiagram(source)).toString();
    expect(after).toBe(fresh);
  });

  it("keeps the parsed message label and note text as they were parsed", () => {
    const diagram = parseSequenceDiagram(source);
    const message = must(diagram.events.find((event) => event.type === "message"));
    const note = must(diagram.events.find((event) => event.type === "note"));
    renderSequence(diagram, undefined, undefined, undefined, budget);
    expect(message.type === "message" && message.label).toBe(label);
    expect(note.type === "note" && note.text).toBe(text);
  });
});
