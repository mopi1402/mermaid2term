import { describe, it, expect } from "vitest";
import { render, renderThemed } from "../../src/index.js";
import { must } from "../../src/must.js";
import { parseGitGraph } from "../../src/diagrams/gitgraph/parser.js";
import { NEWLINE } from "../../src/text/chars.js";

const picture = (source: string): string =>
  render(source, { width: 80 })
    .split(NEWLINE)
    .map((line) => line.trimEnd())
    .join(NEWLINE)
    .replace(/^\n+/u, "")
    .replace(/\n+$/u, "");
const headed = (direction: string, body: string): string => `gitGraph ${direction}:\n${body}`;

const RELEASE = ' commit id: "init" tag: "v1.0.0"\n branch dev\n commit id: "work"\n checkout main\n merge dev tag: "v1.1.0"';
const TWO_TAGS = ' commit id: "a" tag: "x" tag: "y"\n commit id: "b"';
const SECOND_COLUMN = ' commit id: "a"\n branch dev\n commit id: "b" tag: "rc"\n checkout main\n merge dev';
const MERGED_FROM_LEFT = ' commit id: "a"\n branch dev\n commit id: "b"\n checkout main\n commit id: "c"\n checkout dev\n merge main tag: "m"';

describe("a vertical tag stands left of its marker, on the commit's row", () => {
  it("keeps the branch line whole, TB", () => {
    expect(picture(headed("TB", RELEASE))).toBe(
      [
        "          main            dev",
        "            ┊              ┊",
        "[🏷️ v1.0.0] ●──────────────╮",
        "          init             │",
        "            │              │",
        "            │              │",
        "            │              ●",
        "            │            work",
        "            │              │",
        "            │              │",
        "[🏷️ v1.1.0] ○──────────────╯",
        "            ┊              ┊",
        "            ┊              ┊",
        "            ┊              ┊",
      ].join(NEWLINE)
    );
  });

  it("keeps the branch line whole, BT", () => {
    expect(picture(headed("BT", RELEASE))).toBe(
      [
        "            ┊              ┊",
        "            ┊              ┊",
        "            ┊              ┊",
        "[🏷️ v1.1.0] ○──────────────╮",
        "            │              │",
        "            │              │",
        "            │            work",
        "            │              ●",
        "            │              │",
        "            │              │",
        "          init             │",
        "[🏷️ v1.0.0] ●──────────────╯",
        "            ┊              ┊",
        "            ┊              ┊",
        "            ┊              ┊",
        "          main            dev",
      ].join(NEWLINE)
    );
  });

  for (const direction of ["TB", "BT"]) {
    it(`joins several tags on the row, ${direction}`, () => {
      expect(picture(headed(direction, TWO_TAGS)).split(NEWLINE)).toContain("[🏷️ x] [🏷️ y] ●");
    });

    it(`leaves the column to the left whole for a tag on the second column, ${direction}`, () => {
      expect(picture(headed(direction, SECOND_COLUMN)).split(NEWLINE)).toContain("   │  [🏷️ rc] ●");
    });

    it(`moves a tag one row back when a link arrives from the left, ${direction}`, () => {
      const lines = picture(headed(direction, MERGED_FROM_LEFT)).split(NEWLINE);
      const merge = lines.findIndex((line) => line.endsWith("─○"));
      expect(lines[direction === "TB" ? merge - 1 : merge + 1]).toBe("   │  [🏷️ m] │");
      expect(lines[merge]).not.toContain("[🏷️ m]");
    });
  }
});

describe("tags on one commit", () => {
  it("records every tag in order", () => {
    expect(parseGitGraph(headed("TB", TWO_TAGS)).commits[0].tags).toEqual(["x", "y"]);
  });

  it("records none for an empty tag", () => {
    expect(parseGitGraph(headed("TB", ' commit id: "a" tag: ""')).commits[0].tags).toEqual([]);
  });
});

describe("LR tags stay above the marker", () => {
  it("draws every tag over the commit, joined on one row", () => {
    expect(picture(headed("LR", ' commit id: "a" tag: "x" tag: "y"\n commit id: "b" tag: "v1"'))).toBe(
      ["         [🏷️ x] [🏷️ y]   [🏷️ v1]", " main  ╌╌╌╌╌╌╌╌●────────────●╌╌╌", "               a            b"].join(NEWLINE)
    );
  });
});

describe("a tag opens on mermaid's tag shape, a label, where the charset has one", () => {
  const NEIGHBOURS = ' commit id: "a" tag: "cherry-pick:fix"\n commit id: "b" tag: "v3.0.0-rc"';

  it.each(["LR", "TB", "BT"])("writes the label inside the brackets, a space before the name, %s", (direction) => {
    expect(picture(headed(direction, NEIGHBOURS))).toContain("[\u{1f3f7}️ cherry-pick:fix]");
  });

  it("writes none under the compat charset", () => {
    const drawn = render(headed("LR", NEIGHBOURS), { width: 80, charset: "compat" });
    expect(drawn).toContain("[cherry-pick:fix]");
    expect(drawn).not.toContain("\u{1f3f7}");
  });

  it("steps two tagged commits far enough apart for the labels to stand clear, LR", () => {
    const row = picture(headed("LR", NEIGHBOURS)).split(NEWLINE)[0];
    expect(row).toMatch(/\] +\[/u);
  });
});

describe("a tag's ground runs unbroken from bracket to bracket", () => {
  it.each(["LR", "TB"])("gives the space after the label the tag's own ground, %s", (direction) => {
    for (const [theme, ground] of [["default", "48;2;236;236;255"], ["forest", "48;2;205;228;152"]] as const) {
      const drawn = renderThemed(headed(direction, ' commit id: "a" tag: "v2.0.1"'), { width: 80, background: "light" }, theme);
      const run = must(/\u001b\[([0-9;]*)m\u{1f3f7}\ufe0f([^\u001b]*)/u.exec(drawn) ?? undefined);
      expect(run[1]).toContain(ground);
      expect(run[2]).toBe(" v2.0.1");
    }
  });
});
