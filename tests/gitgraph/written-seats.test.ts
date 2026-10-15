import { describe, expect, it } from "vitest";
import { renderThemed } from "../../src/index.js";
import { themeAsked } from "../../src/paint/frontmatter.js";

const HIGHLIGHT_RE = /\[([0-9;]*)m□/u;
const MAIN_LABEL_RE = /38;2;(\d+);(\d+);(\d+);48;2;[0-9;]+m *main/u;

const source = (theme: string, variables: string, direction = "LR"): string =>
  `---\nconfig:\n  theme: ${theme}\n  themeVariables:\n${variables}---\ngitGraph ${direction}:\n` +
  '    commit id: "a"\n    branch dev\n    commit id: "b" type: HIGHLIGHT\n';

const themed = (theme: string, variables: string) => themeAsked(source(theme, variables), theme);

// Each theme's `updateColors`: `gitInv{i} || invert(git{i})`, the seat first shaded 25 toward the page's far side,
// over the `git{i}` the source writes; `dark` and `neutral` compute their seats over the writing, and `default` runs
// its `updateColors` once in its constructor, so its inverses are set before anything is written.
describe("a written git seat re-derives its inverse, as mermaid", () => {
  it("inverts base's and forest's written git1 off its darkened seat, #ff0000 to #80ffff", () => {
    expect(themed("base", '    git1: "#ff0000"\n').variables.gitInv1?.toLowerCase()).toBe("#80ffff");
    expect(themed("forest", '    git1: "#ff0000"\n').variables.gitInv1?.toLowerCase()).toBe("#80ffff");
  });

  it("keeps default's own inverses, set in its constructor, and lightens the seat first on a dark page", () => {
    expect(themed("default", '    git1: "#ff0000"\n').variables.gitInv1?.toLowerCase()).toBe("#0000a1");
    expect(themed("default", '    git0: "#ff0000"\n').variables.gitInv0?.toLowerCase()).toBe("#131300");
    expect(themed("base", '    darkMode: true\n    git2: "#ff0000"\n').variables.gitInv2?.toLowerCase()).toBe("#008080");
  });

  it("keeps a written gitInv, and dark's own inverse whatever git seat is written", () => {
    expect(themed("forest", '    git1: "#ff0000"\n    gitInv1: "#123456"\n').variables.gitInv1).toBe("#123456");
    const dark = themeAsked(source("dark", '    git1: "#ff0000"\n'), "dark");
    expect(dark.variables.gitInv1).toBe(themeAsked(source("dark", '    git2: "#ff0000"\n'), "dark").variables.gitInv1);
  });

  it.each(["LR", "TB"])("draws the highlight's inner square off the written seat (%s)", (direction) => {
    const plain = renderThemed(source("base", '    darkMode: false\n', direction), { width: 80, background: "light" }, "base");
    const written = renderThemed(source("base", '    git1: "#ff0000"\n', direction), { width: 80, background: "light" }, "base");
    expect(HIGHLIGHT_RE.exec(written)?.[1]).not.toBe(HIGHLIGHT_RE.exec(plain)?.[1]);
  });
});

// `theme-base.js` and the neo and redux files: `gitBranchLabel{i} || branchLabelColor`; `theme-neutral.js` pins seats 1
// and 3 to white; `dark`, `default` and `forest` never read it.
describe("a written branchLabelColor inks every branch label, as mermaid", () => {
  it("reaches each of base's labels but one written on its own", () => {
    const v = themed("base", '    branchLabelColor: "#ff0000"\n    gitBranchLabel2: "#00ff00"\n').variables;
    expect([v.gitBranchLabel0, v.gitBranchLabel1, v.gitBranchLabel2, v.gitBranchLabel7]).toEqual(["#ff0000", "#ff0000", "#00ff00", "#ff0000"]);
  });

  it("skips neutral's white seats, and leaves default's labels alone", () => {
    const neutral = themed("neutral", '    branchLabelColor: "#ff0000"\n').variables;
    expect(neutral.gitBranchLabel0).toBe("#ff0000");
    expect(neutral.gitBranchLabel1).not.toBe("#ff0000");
    expect(themed("default", '    branchLabelColor: "#ff0000"\n').variables.gitBranchLabel1).not.toBe("#ff0000");
  });

  it.each(["LR", "TB"])("inks base's main label in the written red, weighed on its band (%s)", (direction) => {
    const out = renderThemed(source("base", '    branchLabelColor: "#ff0000"\n', direction), { width: 80, background: "light" }, "base");
    const [, r, g, b] = (MAIN_LABEL_RE.exec(out) ?? []).map(Number);
    expect(r).toBeGreaterThan(200);
    expect(Math.max(g, b)).toBeLessThan(40);
  });
});
