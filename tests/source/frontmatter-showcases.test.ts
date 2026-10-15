import { describe, it, expect } from "vitest";
import { renderThemed } from "../../src/index.js";
import { corpus, DRAWN } from "../../scripts/corpus.js";

const FENCE = "---";
// The lines that open a block rather than say anything: taking one out takes its whole block with it.
const STRUCTURAL_RE = /^\s*(?:---|config:|themeVariables:|class:|gantt:)\s*$/u;
const WIDTH = 80;
// Both grounds, never the host's: a colour that says something over white can land on the ink the dark side
// already draws with, and the showcase would teach nothing to half its readers.
const GROUNDS = ["light", "dark"] as const;

const SHOWCASES = corpus(DRAWN).filter(({ name }) => name === "frontmatter");

const linesOf = (source: string): string[] => source.split("\n");

// A showcase teaches what a reader can SEE, so a key that changes nothing in the drawing teaches nothing: the
// line is either wrong (a variable this kind never reads) or masked by another one written under it.
describe("the frontmatter showcases", () => {
  it("has one per kind, eighteen of them", () => {
    expect(SHOWCASES.length).toBe(18);
  });

  it.each(SHOWCASES.map(({ id, source }) => [id, source]))("%s: every line it declares moves the drawing, on either ground", (_name, source) => {
    const lines = linesOf(source);
    const close = lines.indexOf(FENCE, 1);
    for (const background of GROUNDS) {
      const drawn = renderThemed(source, { width: WIDTH, background });
      const idle = lines.slice(1, close).filter((line, at) => {
        if (STRUCTURAL_RE.test(line) || line.trim().startsWith("title:")) return false;
        const without = [...lines.slice(0, at + 1), ...lines.slice(at + 2)].join("\n");
        return renderThemed(without, { width: WIDTH, background }) === drawn;
      });
      expect({ background, idle }).toEqual({ background, idle: [] });
    }
  });
});
