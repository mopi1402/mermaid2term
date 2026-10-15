import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";

const drawn = (source: string): string => render(source, { width: 80 });

describe("a node's shape is the one its id opens, never a delimiter inside its label", () => {
  it("keeps `A[a > b]` a rectangle holding `a > b`, as `>` opens the flag only against the id", () => {
    const out = drawn("flowchart LR\n  A[a > b] --> B");
    expect(out).toContain("a > b");
    expect(out).toEqual(drawn('flowchart LR\n  A["a > b"] --> B'));
  });

  it("keeps a label holding a tag its brackets' shape", () => {
    expect(drawn("flowchart LR\n  A[x</b>y] --> B")).toEqual(drawn("flowchart LR\n  A[xy] --> B"));
    expect(drawn("flowchart LR\n  A(one [two]) --> B")).toContain("one [two]");
  });

  it("still reads the flag and the nested openers where the id opens them", () => {
    expect(drawn("flowchart LR\n  A>flag] --> B")).toEqual(drawn("flowchart LR\n  A@{ shape: odd, label: \"flag\" } --> B"));
    expect(drawn("flowchart LR\n  A[(db)] --> B")).toEqual(drawn("flowchart LR\n  A@{ shape: cyl, label: \"db\" } --> B"));
  });

  it("reads a block the same way, keeping both blocks of a row", () => {
    const out = drawn("block-beta\n  A[a > b] B[x > y]");
    expect(out).toContain("a > b");
    expect(out).toContain("x > y");
  });

  it("draws a block's `(-t-)` as the rectangle mermaid falls back to, `typeStr2Type` naming no shape for it", () => {
    expect(drawn('block-beta\n  a(-"t"-) b')).toEqual(drawn('block-beta\n  a["t"] b'));
  });
});
