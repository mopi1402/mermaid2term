import { describe, it, expect } from "vitest";
import { render } from "../../src/index.js";

describe("a mindmap id and the shape it wraps, read as a shape and never as text", () => {
  const SHAPED: ReadonlyArray<readonly [string, string]> = [
    ["circle", "root((Central))"],
    ["square", "id1[Central]"],
    ["hexagon", "id2{{Central}}"],
    ["rounded square", "id3(Central)"],
    ["cloud", "id4)Central("],
    ["bang", "id5))Central(("],
  ];

  it.each(SHAPED)("keeps the text alone out of a %s behind an id", (_shape, written) => {
    expect(render(`mindmap\n  ${written}\n    Branch\n`, { width: 60 })).toContain("Central ");
  });

  it.each(SHAPED)("draws neither the id nor the delimiters of a %s", (_shape, written) => {
    const drawn = render(`mindmap\n  ${written}\n    Branch\n`, { width: 60 });
    expect(drawn).not.toContain(written);
  });

  it("reads the circle rather than leaving half of it in the text", () => {
    expect(render("mindmap\n  ((Central))\n    Branch\n", { width: 60 })).toContain("Central ");
  });

  it("leaves a bare label alone, having no delimiters to drop", () => {
    expect(render("mindmap\n  Plain label\n    Branch\n", { width: 60 })).toContain("Plain label");
  });
});
