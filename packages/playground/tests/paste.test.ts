import { describe, expect, it } from "vitest";
import { dedented } from "@/paste";

describe("a source pasted with the margin a copy put on it", () => {
  it("takes the margin every line carries and keeps every indent under it", () => {
    expect(dedented("    sequenceDiagram\n        participant A\n        A->>B: hi\n")).toBe(
      "sequenceDiagram\n    participant A\n    A->>B: hi\n"
    );
  });

  it("leaves a mindmap's own hierarchy standing, which is what its indents mean", () => {
    expect(dedented("  mindmap\n    root\n      one\n        deep\n      two\n")).toBe(
      "mindmap\n  root\n    one\n      deep\n    two\n"
    );
  });

  it("touches nothing where a line already opens at the margin, or where a single line was pasted", () => {
    const flat = "flowchart LR\n    A --> B\n";
    expect(dedented(flat)).toBe(flat);
    expect(dedented("    participant A")).toBe("    participant A");
  });

  it("never loses a line, whatever the margin: only leading blanks go", () => {
    const block = "sequenceDiagram\n    participant B@{\n      type: database\n    }\n    A->>B: hi\n";
    for (const margin of ["", " ", "    ", "\t"]) {
      const pasted = block.split("\n").map((line) => (line === "" ? line : margin + line)).join("\n");
      expect(dedented(pasted).split("\n")).toHaveLength(pasted.split("\n").length);
      expect(dedented(pasted).replace(/^[^\S\n]+/gmu, "")).toBe(block.replace(/^[^\S\n]+/gmu, ""));
    }
  });

  it("counts blank lines out, and keeps a tab margin apart from a space one", () => {
    expect(dedented("  a\n\n  b\n")).toBe("a\n\nb\n");
    expect(dedented("\ta\n  b\n")).toBe("\ta\n  b\n");
  });
});
