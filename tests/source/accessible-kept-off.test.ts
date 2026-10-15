import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";

const ACC = "  accTitle: hidden title\n  accDescr {\n    hidden body\n  }\n  accDescr: hidden line\n";

describe("accessibility statements never reach the drawing", () => {
  it.each([
    ["sequence", `sequenceDiagram\n${ACC}  A->>C: shown\n`],
    ["block", `block-beta\n${ACC}  a b\n`],
    ["gitgraph", `gitGraph\n${ACC}  commit id: "shown"\n`],
    ["gitgraph TB", `gitGraph TB:\n${ACC}  commit id: "shown"\n`],
  ])("%s", (_, source) => {
    const drawn = render(source, { width: 80 });
    expect(drawn).not.toContain("hidden");
    expect(drawn).not.toContain("accTitle");
  });

  it("a sequence message written inside `accDescr {` is not drawn", () => {
    const drawn = render("sequenceDiagram\n  accDescr {\n    A->>B: hi\n  }\n  A->>C: real\n", { width: 80 });
    expect(drawn).not.toContain(" B ");
    expect(drawn).not.toContain("hi");
  });
});
