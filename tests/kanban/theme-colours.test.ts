import { describe, expect, it } from "vitest";
import { renderThemedText } from "../../src/index.js";
import { DEEP_SUFFIX, RIM_TAIL, SECTION_PREFIX, indexed } from "../../src/canvas/keys.js";

// mermaid 12's kanban stylesheet fills column N with `cScale<N+1>` lightened by 10, up to its tenth column, and the
// ones past it with the SVG's own `textColor`; titles and card words are `textColor`, a card is filled `background`
// and stroked `nodeBorder`, on all eleven themes, each hex as khroma's `toHex` rounds the theme's own value.
const source = ["kanban", "  c1[Todo]", "    t1[Write docs]", "  c2[Doing]", "    t2[Ship it]", "  c3[Done]", "    t3[Tag it]",
  ...Array.from({ length: 9 }, (_, at) => `  d${at}[D${at}]`)].join("\n");

type Ground = "light" | "dark";

const THEMES: ReadonlyArray<readonly [string, Ground, readonly string[], string, string, string, string]> = [
  ["redux-color", "light", ["#FFD09D", "#F3E5FF", "#A9F6C6"], "#28253D", "#FFFFFF", "#28253D", "#28253D"],
  ["dark", "dark", ["#771955", "#546E76", "#754628"], "#CCCCCC", "#333333", "#CCCCCC", "#CCCCCC"],
  ["base", "light", ["#AAC6FF", "#ECFF90", "#B4FF90"], "#333333", "#F4F4F4", "#EEDDBB", "#333333"],
];

describe.each([60, 200])("a kanban at width %i on mermaid 12's themes", (width) => {
  const styleOf = (theme: string, background: Ground, owner: string): string =>
    renderThemedText(source, { width, background }, theme).rows.flat().find((cell) => cell.owner === owner && cell.ch.trim() !== "")?.style ?? "";

  it.each(THEMES)("%s fills its columns off cScale shifted by two, and cards on background in nodeBorder", (theme, background, fills, text, card, border, past) => {
    expect(fills.map((_, at) => styleOf(theme, background, indexed(SECTION_PREFIX, at)))).toEqual(fills.map((fill) => `bold ${text} on ${fill}`));
    expect(styleOf(theme, background, indexed(SECTION_PREFIX, 0) + DEEP_SUFFIX)).toBe(`bold ${text} on ${card}`);
    expect(styleOf(theme, background, indexed(SECTION_PREFIX, 1) + DEEP_SUFFIX + RIM_TAIL)).toBe(`${border} on ${card}`);
    if (width === 200) expect(styleOf(theme, background, indexed(SECTION_PREFIX, 10))).toMatch(new RegExp(` on ${past}$`, "u"));
  });
});

// mermaid 12 strokes a column's rect in its own fill, so the frame melts into the column; under `mono` it stays drawn.
describe.each([60, 200])("a kanban column's frame at width %i", (width) => {
  const rimOf = (theme: string, background: Ground): string =>
    renderThemedText(source, { width, background }, theme).rows.flat().find((cell) => cell.owner === indexed(SECTION_PREFIX, 0) + RIM_TAIL && cell.ch.trim() !== "")?.style ?? "";

  it.each(THEMES)("%s inks it in the column's fill", (theme, background, fills) => {
    expect(rimOf(theme, background)).toBe(`${fills[0]} on ${fills[0]}`);
  });

  it("mono keeps it drawn", () => {
    expect(rimOf("mono", "dark")).not.toBe("");
    expect(rimOf("mono", "dark")).not.toMatch(/^(\S+) on \1$/u);
  });
});
