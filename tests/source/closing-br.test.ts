import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";

const rowsOf = (source: string): string[] => render(source, { width: 80 }).split("\n");
const rowOf = (rows: readonly string[], text: string): number => rows.findIndex((row) => row.includes(text));

describe("`</br>`, read as a line break the way mermaid 12 reads it (#8048)", () => {
  it.each([
    ["a flowchart node", "flowchart LR\n  A[one</br>two] --> B"],
    ["a sequence note", "sequenceDiagram\n  A->>B: hi\n  Note over A: one</br>two"],
    ["a mindmap node", "mindmap\n  Root\n    one</br>two"],
  ])("breaks %s onto two rows, the tag never drawn", (_kind, source) => {
    const rows = rowsOf(source);
    expect(rows.join("\n")).not.toContain("br>");
    const one = rowOf(rows, "one");
    expect(one).toBeGreaterThanOrEqual(0);
    expect(rowOf(rows, "two")).toBe(one + 1);
  });

  it("keeps the flowchart node the rectangle its brackets ask for", () => {
    expect(rowsOf("flowchart LR\n  A[one</br>two] --> B")).toEqual(rowsOf("flowchart LR\n  A[one<br>two] --> B"));
  });
});
