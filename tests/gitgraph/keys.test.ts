import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";
import { parseGitGraph } from "../../src/diagrams/gitgraph/parser.js";

// mermaid keys a commit the source leaves unnamed by `seq-` and a random tail so it never meets a written id; here
// every commit has a key of its own, and the unnamed one shows its place in the source.
describe("a commit is found by a key of its own, whatever the source calls it", () => {
  const NAMED_THEN_BARE = 'gitGraph\n commit id: "1"\n commit\n commit\n branch dev\n commit\n checkout main\n merge dev';

  it("keeps a bare commit that falls on a written id, chained to the one before", () => {
    const commits = parseGitGraph(NAMED_THEN_BARE).commits;
    expect(new Set(commits.map((commit) => commit.key)).size).toBe(commits.length);
    expect(commits.slice(1, 3).map((commit) => commit.parents)).toEqual([[commits[0].key], [commits[1].key]]);
  });

  it.each(["LR", "TB"])("draws every commit of the trunk, one line through them, %s", (direction) => {
    const drawn = render(NAMED_THEN_BARE.replace("gitGraph", `gitGraph ${direction}:`), { width: 80 });
    expect(drawn.match(/[●○]/gu)).toHaveLength(5);
    if (direction === "LR") expect(drawn.split("\n")[0]).toMatch(/●─+●─+●─+○/u);
  });

  it("writes a name the source gives twice under both commits, a reference finding the last", () => {
    const source = 'gitGraph\n commit id: "A"\n commit id: "A"\n commit id: "B"\n reset A\n commit id: "C"';
    const commits = parseGitGraph(source).commits;
    expect(commits.map((commit) => commit.id)).toEqual(["A", "A", "B", "C"]);
    expect(commits[3].parents).toEqual([commits[1].key]);
    expect(render(source, { width: 80 }).match(/\bA\b/gu)).toHaveLength(2);
  });
});

describe("a horizontal graph's branch names stand right against their lines, as mermaid's label boxes", () => {
  it("ends every name on one column, one blank before the line", () => {
    const source = "gitGraph\n commit\n branch feature-a\n commit\n checkout main\n branch feature-b\n commit";
    const rows = render(source, { width: 80 }).split("\n").filter((row) => /main|feature/u.test(row));
    const ends = rows.map((row) => row.search(/ +╌/u));
    expect(new Set(ends).size).toBe(1);
    expect(rows[0]).toMatch(/^ {6}main {2}╌/u);
  });
});
