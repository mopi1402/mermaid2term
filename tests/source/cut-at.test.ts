import { describe, expect, it } from "vitest";

import { cutAt } from "../../src/source/quotes.js";
import { openedIn } from "../../src/diagrams/@common/sections.js";

describe("cutAt", () => {
  it("cuts only at the given indices whose character cuts, dropping that character", () => {
    expect(cutAt("a,b;c,d", [1, 5], (ch) => ch === "," || ch === ";")).toEqual(["a", "b;c", "d"]);
    expect(cutAt("a,b", [0], (ch) => ch === ",")).toEqual(["a,b"]);
    expect(cutAt(",", [0], (ch) => ch === ",")).toEqual(["", ""]);
  });
});

describe("openedIn", () => {
  it("keeps the open one, or pushes and returns a new one once", () => {
    const list: string[] = [];
    const made = openedIn(list, undefined, () => "new");
    expect(made).toBe("new");
    expect(openedIn(list, made, () => "other")).toBe("new");
    expect(list).toEqual(["new"]);
  });
});
