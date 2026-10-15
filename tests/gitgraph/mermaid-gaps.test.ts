import { describe, it, expect } from "vitest";
import { render } from "../../src/index.js";
import { parseGitGraph } from "../../src/diagrams/gitgraph/parser.js";
import { NEWLINE } from "../../src/text/chars.js";
import { withConfig } from "../support/frontmatter.js";

const drawn = (source: string): string[] => render(source, { width: 80 }).split(NEWLINE).map((line) => line.trimEnd());
const picture = (source: string): string => drawn(source).join(NEWLINE).replace(/^\n+/u, "");
const DIRECTIONS = ["LR", "TB", "BT"] as const;
const headed = (direction: string, body: string): string => `gitGraph ${direction}:\n${body}`;
const initWith = (config: string, direction: string, body: string): string =>
  `%%{init: {'gitGraph': {${config}}}}%%\n${headed(direction, body)}`;

const BRANCH_AND_MERGE = ' commit id: "a"\n branch dev\n commit id: "b"\n checkout main\n commit id: "c"\n merge dev id: "m"';

describe("a quoted branch name holding a space merges like any other", () => {
  const body = ' commit\n branch "docs update"\n commit\n checkout main\n merge "docs update"';

  it("records both parents of the merge", () => {
    const merge = parseGitGraph(headed("LR", body)).commits[2];
    expect(merge.parents).toEqual(["0", "1"]);
    expect(merge.origin).toBe("merge");
  });

  it("joins the merged line to the merge, LR", () => {
    expect(picture(headed("LR", body))).toBe(
      [
        "        main  ╌╌╌●───────────○╌╌╌",
        "                 0           │",
        "                 │           │",
        " docs update  ╌╌╌╰─────●─────╯╌╌╌",
        "                       1",
      ].join(NEWLINE)
    );
  });

  it("joins the merged line to the merge, TB", () => {
    const lines = drawn(headed("TB", body));
    expect(lines.some((line) => /○─+╯/u.test(line))).toBe(true);
  });
});

describe("words centred on the first vertical branch start on the canvas", () => {
  for (const direction of ["TB", "BT"]) {
    it(`keeps a long id whole, ${direction}`, () => {
      expect(drawn(headed(direction, ' commit id: "scaffold"\n commit id: "b"'))).toContain(" scaffold");
    });

    it(`keeps a tag whole, ${direction}`, () => {
      const lines = drawn(headed(direction, ' commit id: "init" tag: "v1.0.0"\n commit id: "b"'));
      expect(lines).toContain("[🏷️ v1.0.0] ●");
    });
  }
});

// mermaid 11.17.0 `drawBranches`: every `.branch` line runs from the graph's start to `maxPos`, dashed.
describe("a branch line runs the whole graph, dashed where no arrow runs along it", () => {
  it("runs a BT branch from the foot to past the last commit of any branch", () => {
    expect(picture(headed("BT", ' commit id: "a"\n branch dev\n commit id: "b"\n checkout main\n commit id: "c"'))).toBe(
      [
        "   ┊         ┊",
        "   ┊         ┊",
        "   c         ┊",
        "   ●         ┊",
        "   │         ┊",
        "   │         ┊",
        "   │         b",
        "   │         ●",
        "   │         │",
        "   │         │",
        "   a         │",
        "   ●─────────╯",
        "   ┊         ┊",
        "   ┊         ┊",
        "   ┊         ┊",
        " main       dev",
      ].join(NEWLINE)
    );
  });

  it("runs a TB branch on past its last commit, dashed", () => {
    const lines = drawn(headed("TB", ' commit id: "a"\n branch dev\n commit id: "b"\n checkout main\n commit id: "c"'));
    const b = lines.findIndex((line) => line.trimEnd().endsWith("●") && line.includes("│"));
    expect(lines[b + 2]).toMatch(/│ +┊$/u);
    expect(lines[lines.length - 1]).toMatch(/^ +┊ +┊$/u);
  });
});

describe("a connector ends in the corner or tee it is, as mermaid's arrows bend", () => {
  for (const direction of DIRECTIONS) {
    it(`draws no cross at a branch-off or merge end, ${direction}`, () => {
      const text = drawn(headed(direction, BRANCH_AND_MERGE)).join(NEWLINE);
      expect(text).not.toContain("┼");
      expect(text).toMatch(/[╮╰]/u);
      expect(text).toMatch(/╯/u);
    });
  }

  it("leaves the parent's step and runs along the child's branch, LR", () => {
    expect(picture(headed("LR", BRANCH_AND_MERGE))).toBe(
      [
        " main  ╌╌╌●───────────●─────○╌╌╌",
        "          a           c     m",
        "          │                 │",
        "  dev  ╌╌╌╰─────●───────────╯╌╌╌",
        "                b",
      ].join(NEWLINE)
    );
  });

  it("leaves the parent's row and runs down the child's branch, TB", () => {
    const lines = drawn(headed("TB", BRANCH_AND_MERGE));
    expect(lines.find((line) => line.includes("╮"))).toMatch(/^\s*●─+╮$/u);
  });

  it("crosses only where a connector passes a line it does not end on", () => {
    const text = drawn(headed("LR", ' commit id: "a"\n branch one\n commit id: "b"\n checkout main\n branch two\n commit id: "c"\n checkout main\n merge two id: "m"')).join(NEWLINE);
    expect(text).toContain("├");
    expect(text).not.toContain("┼");
  });
});

describe("showBranches", () => {
  for (const direction of DIRECTIONS) {
    it(`false draws neither the names nor the branch lines, ${direction}`, () => {
      const text = drawn(initWith("'showBranches': false", direction, BRANCH_AND_MERGE)).join(NEWLINE);
      expect(text).not.toContain("main");
      expect(text).not.toContain("dev");
      expect(text).toContain("●");
    });
  }

  it("false keeps only the arrows between commits, LR", () => {
    expect(picture(initWith("'showBranches': false", "LR", BRANCH_AND_MERGE))).toBe(
      [" ●───────────●─────○", " a           c     m", " │                 │", " ╰─────●───────────╯", "       b"].join(NEWLINE)
    );
  });
});

describe("showCommitLabel", () => {
  for (const direction of DIRECTIONS) {
    it(`false writes no id and keeps the tags, ${direction}`, () => {
      const text = drawn(initWith("'showCommitLabel': false", direction, ' commit id: "alpha" tag: "v1"\n commit id: "beta"')).join(NEWLINE);
      expect(text).not.toContain("alpha");
      expect(text).not.toContain("beta");
      expect(text).toContain("[🏷️ v1]");
    });
  }

  it("is read from the frontmatter too", () => {
    const text = drawn(withConfig({ gitGraph: { showCommitLabel: false } }, `gitGraph\n commit id: "alpha"`)).join(NEWLINE);
    expect(text).not.toContain("alpha");
  });
});

describe("the labels mermaid leaves out", () => {
  it("writes no label under a merge the source did not name", () => {
    const text = drawn(headed("LR", ' commit id: "a"\n branch dev\n commit id: "b"\n checkout main\n merge dev')).join(NEWLINE);
    expect(text).not.toMatch(/\b2\b/u);
  });

  it("tags a cherry-pick with its source instead of a label", () => {
    const text = drawn(headed("LR", ' commit id: "a"\n branch dev\n commit id: "b"\n checkout main\n cherry-pick id: "b"')).join(NEWLINE);
    expect(text).toContain("[🏷️ cherry-pick:b]");
    expect(text).not.toContain("b-cherry");
  });

  it("an empty tag shows nothing", () => {
    const text = drawn(headed("LR", ' commit id: "a"\n branch dev\n commit id: "b"\n checkout main\n cherry-pick id: "b" tag: ""')).join(NEWLINE);
    expect(text).not.toContain("[");
  });
});

describe("parallelCommits", () => {
  const body = ' commit id: "a"\n branch dev\n commit id: "b"\n checkout main\n commit id: "c"';

  it("puts commits one step past their parent, sharing a column, LR", () => {
    const lines = drawn(initWith("'parallelCommits': true", "LR", body));
    const main = lines.find((line) => line.includes("main")) ?? "";
    const dev = lines.find((line) => line.includes("dev")) ?? "";
    expect(main.lastIndexOf("●")).toBe(dev.lastIndexOf("●"));
  });

  for (const direction of ["TB", "BT"]) {
    it(`puts both children of a on one row, ${direction}`, () => {
      const lines = drawn(initWith("'parallelCommits': true", direction, body));
      expect(lines.some((line) => (line.match(/●/gu) ?? []).length === 2)).toBe(true);
    });
  }

  it("stays temporal by default", () => {
    const lines = drawn(headed("LR", body));
    const main = lines.find((line) => line.includes("main")) ?? "";
    const dev = lines.find((line) => line.includes("dev")) ?? "";
    expect(main.lastIndexOf("●")).toBeGreaterThan(dev.lastIndexOf("●"));
  });
});

describe("branch order", () => {
  const rowsOf = (lines: string[], names: string[]): number[] => names.map((name) => lines.findIndex((line) => line.trimStart().startsWith(`${name} `)));

  it("sorts a branch without order as 0, before ordered ones", () => {
    const lines = drawn(headed("LR", " commit\n branch a order: 1\n commit\n checkout main\n branch b\n commit"));
    const [main, b, a] = rowsOf(lines, ["main", "b", "a"]);
    expect(main).toBeLessThan(b);
    expect(b).toBeLessThan(a);
  });

  it("honours mainBranchOrder", () => {
    const source = withConfig({ gitGraph: { mainBranchOrder: 2 } }, "gitGraph\n commit\n branch a\n commit\n branch b order: 3\n commit\n branch c order: 1\n commit");
    const [a, c, main, b] = rowsOf(drawn(source), ["a", "c", "main", "b"]);
    expect([a, c, main, b]).toEqual([...[a, c, main, b]].sort((x, y) => x - y));
    expect(a).toBeGreaterThanOrEqual(0);
  });

  it("honours mainBranchOrder in an init directive, TB", () => {
    const lines = drawn(initWith("'mainBranchOrder': 2", "TB", " commit\n branch a order: 1\n commit"));
    const names = lines.find((line) => line.includes("main")) ?? "";
    expect(names.indexOf("a")).toBeLessThan(names.indexOf("main"));
  });
});

describe("the body's title statement", () => {
  for (const direction of DIRECTIONS) {
    it(`is drawn above the graph, ${direction}`, () => {
      const lines = drawn(headed(direction, ' title Release flow %% note\n commit id: "a"'));
      const first = lines.findIndex((line) => line.trim() !== "");
      expect(lines[first].trim()).toBe("Release flow");
      expect(lines[first + 1]).toBe("");
    });
  }

  it("wins over a frontmatter title, one title drawn", () => {
    const text = drawn(`---\ntitle: Front\n---\ngitGraph\n title Body\n commit id: "a"`).join(NEWLINE);
    expect(text).toContain("Body");
    expect(text).not.toContain("Front");
  });

  it("is not read from a commit that mentions it", () => {
    expect(parseGitGraph('gitGraph\n commit id: "title x"').title).toBe("");
  });
});

describe("strings and statements mermaid 12's langium grammar reads", () => {
  for (const direction of ["LR", "TB"] as const) {
    it(`reads a statement written on the header line, ${direction}`, () => {
      const parsed = parseGitGraph(`gitGraph ${direction}: commit id: "A"\n commit id: "B"`);
      expect(parsed.direction).toBe(direction);
      expect(parsed.commits.map((commit) => commit.id)).toEqual(["A", "B"]);
      const text = drawn(`gitGraph ${direction}: commit id: "A"\n commit id: "B"`).join(NEWLINE);
      expect(text).toMatch(/\bA\b/u);
      expect(text).toMatch(/\bB\b/u);
    });

    it(`reads single-quoted strings and a backslash-escaped quote, ${direction}`, () => {
      const source = `gitGraph ${direction}:\n commit id: 'A' tag: 'x'\n commit id: "say \\"hi\\""\n branch 'dev'\n commit id: 'D'\n checkout 'main'\n merge 'dev' id: 'M'\n cherry-pick id: 'D'`;
      const parsed = parseGitGraph(source);
      expect(parsed.commits.map((commit) => commit.id)).toEqual(["A", 'say "hi"', "D", "M", "4"]);
      expect(parsed.commits[0].tags).toEqual(["x"]);
      expect(parsed.commits[3].parents).toEqual(["1", "2"]);
      const text = drawn(source).join(NEWLINE);
      expect(text).toContain('say "hi"');
      expect(text).toContain("x]");
    });
  }

  it("reads the header alone as before", () => {
    expect(parseGitGraph("gitGraph\n commit").commits).toHaveLength(1);
    expect(parseGitGraph("gitGraph:\n commit").commits).toHaveLength(1);
  });
});

describe("a gitGraph `title`, read by langium's common TITLE rule and value converter", () => {
  it.each(["LR", "TB"])("folds runs of blanks to one and cuts a trailing comment, direction %s", (direction) => {
    const source = headed(direction, "  title  Release    notes %% draft\n  commit\n");
    expect(parseGitGraph(source).title).toBe("Release notes");
    for (const width of [40, 120]) {
      const out = render(source, { width });
      expect(out).toContain("Release notes");
      expect(out).not.toContain("draft");
    }
  });
});
