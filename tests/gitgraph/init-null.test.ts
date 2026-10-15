import { describe, it, expect } from "vitest";
import { parseGitGraph } from "../../src/diagrams/gitgraph/parser.js";
import { renderGitGraph } from "../../src/diagrams/gitgraph/render.js";

const SOURCE = "gitGraph\n  commit\n  branch develop\n  commit\n  checkout main\n  merge develop\n";
const DIRECTIVES = ["%%{init: null}%%", '%%{init: {"gitGraph": null}}%%'];

const drawn = (text: string): string => renderGitGraph(parseGitGraph(text)).toString();

describe("an init directive whose JSON is null, ignored like any unreadable one", () => {
  for (const directive of DIRECTIVES) {
    it(`parses ${directive} without throwing and keeps the default main branch`, () => {
      const parsed = parseGitGraph(`${directive}\n${SOURCE}`);
      expect(parsed.mainBranchName).toBe(parseGitGraph(SOURCE).mainBranchName);
      expect(parsed.commits.length).toBe(parseGitGraph(SOURCE).commits.length);
    });

    it(`renders ${directive} to the same drawing as the bare source`, () => {
      expect(drawn(`${directive}\n${SOURCE}`)).toBe(drawn(SOURCE));
    });
  }
});
