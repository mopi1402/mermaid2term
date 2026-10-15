import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";
import { parseGitGraph } from "../../src/diagrams/gitgraph/parser.js";

describe("a langium kind cuts a `%%` comment anywhere outside a string quoted either way", () => {
  it.each(["LR", "TB"])("gitgraph keeps the statement before a trailing comment, %s", (direction) => {
    const graph = parseGitGraph(`gitGraph ${direction}:\n  commit\n  branch dev %% note\n  commit\n  checkout main %% back\n  commit\n`);
    expect(graph.commits.map((commit) => commit.branch)).toEqual(["main", "dev", "main"]);
  });

  it("packet keeps `%%` inside a single-quoted label", () => {
    expect(render("packet-beta\n  0-7: '50%% x'\n", { width: 80 })).toContain("50%% x");
  });

  it("treemap keeps `%%` inside a single-quoted name", () => {
    expect(render("treemap-beta\n  '50%% x': 3\n", { width: 80 })).toContain("50%% x");
  });
});
