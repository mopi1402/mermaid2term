import { describe, it, expect } from "vitest";
import { addInto, ensured, pushInto } from "../../src/must.js";

describe("ensured", () => {
  it("makes a value only on a miss and hands back the one stored", () => {
    const map = new Map<string, string[]>();
    let made = 0;
    const make = (key: string): string[] => {
      made++;
      return [key];
    };
    const first = ensured(map, "a", make);
    expect(ensured(map, "a", make)).toBe(first);
    expect(made).toBe(1);
    expect(first).toEqual(["a"]);
  });

  it("keeps the order keys first came in", () => {
    const map = new Map<string, number>([["b", 1]]);
    ensured(map, "a", () => 2);
    ensured(map, "b", () => 3);
    expect([...map]).toEqual([["b", 1], ["a", 2]]);
  });
});

describe("pushInto and addInto", () => {
  it("group items under their key in the order they come", () => {
    const lists = new Map<string, number[]>();
    const sets = new Map<string, Set<number>>();
    const entries: Array<[string, number]> = [["x", 1], ["y", 2], ["x", 3], ["x", 1]];
    for (const [key, item] of entries) {
      pushInto(lists, key, item);
      addInto(sets, key, item);
    }
    expect([...lists]).toEqual([["x", [1, 3, 1]], ["y", [2]]]);
    expect([...sets].map(([key, held]) => [key, [...held]])).toEqual([["x", [1, 3]], ["y", [2]]]);
  });
});
