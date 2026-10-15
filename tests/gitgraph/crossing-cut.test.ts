import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";

const source = (direction: string): string => `gitGraph ${direction}:
    commit id: "init"
    branch feature/search-v2.1
    commit id: "indexer"
    switch main
    branch "cherry-pick"
    commit id: "backport"
    checkout feature/search-v2.1
    commit id: "ranking"
    switch main
    merge "cherry-pick" id: "backports"
    merge feature/search-v2.1 id: "search-v2"
`;

// Two lines never cross: where a merge arrow passes over another branch, that branch's lane runs on and the arrow is cut.
describe("a merge arrow sent across a branch", () => {
  it.each(["LR", "TB"])("is cut by the lane it passes (%s)", (direction) => {
    const drawn = render(source(direction), { width: 100 });
    expect(drawn).not.toContain("┼");
    const lane = direction === "LR" ? /ranking.*\n/u : /backports/u;
    expect(drawn).toMatch(lane);
  });

  it("keeps the lane whole in LR", () => {
    const row = render(source("LR"), { width: 100 }).split("\n").find((line) => line.includes("feature/search-v2.1")) ?? "";
    expect(row).toMatch(/●─+╯/u);
  });

  it("keeps the lane whole in TB", () => {
    const row = render(source("TB"), { width: 100 }).split("\n").find((line) => line.includes("○") && line.includes("╯") && line.indexOf("○") < 8) ?? "";
    expect(row).toMatch(/○─+│─+╯/u);
  });
});
