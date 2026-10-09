import { describe, expect, it } from "vitest";
import { render, renderThemedText } from "../../src/index.js";
import { displayWidth } from "../../src/text/width.js";

const TITLE = "Onboarding a new engineer from first login to first merged pull request";
const TITLED = `journey\n  title ${TITLE}\n  section Day one\n    Log in: 4: Dev\n`;
const words = (text: string): string[] => text.split(/\s+/u).filter((word) => word !== "");

// A title wider than the boxes widens the drawing while the budget has room, and folds on words once it has none.
describe.each([80, 120])("a journey title wider than its boxes, at width %i", (width) => {
  it("is drawn whole on one line", () => {
    const rows = render(TITLED, { width }).split("\n");
    expect(rows.some((row) => row.trim() === TITLE)).toBe(true);
    expect(Math.max(...rows.map(displayWidth))).toBeLessThanOrEqual(width);
  });
});

describe.each([30, 45])("a journey title wider than its budget, at width %i", (width) => {
  it("folds on words, every word kept whole, inside the budget", () => {
    const rows = render(TITLED, { width }).split("\n");
    const titleRows = rows.slice(0, rows.findIndex((row) => row.trim() === ""));
    expect(titleRows.length).toBeGreaterThan(1);
    expect(words(titleRows.join(" "))).toEqual(words(TITLE));
    expect(Math.max(...rows.map(displayWidth))).toBeLessThanOrEqual(width);
  });
});

// mermaid 12 writes a section header's words in `textColor`, the `.label` div's colour, on the section's fill
// (checked headless on 2026-09-29: #333 on default and neo, #CCC on dark, #28253D on redux-color).
const SECTIONS = "journey\n  title Day\n  section Go to work\n    Make tea: 5: Me\n  section Home\n    Sit down: 3: Me, Cat\n";
const TEXT_COLOURS: ReadonlyArray<readonly [string, "light" | "dark", string]> = [
  ["default", "light", "#333333"],
  ["neo", "light", "#333333"],
  ["dark", "dark", "#CCCCCC"],
  ["redux-color", "light", "#28253D"],
];

describe.each([60, 100])("a journey section header's words, at width %i", (width) => {
  const cellOf = (theme: string, background: "light" | "dark", text: string, from = 0) => {
    const rows = renderThemedText(SECTIONS, { width, background }, theme).rows;
    const row = rows.slice(from).find((cells) => cells.map((cell) => cell.ch).join("").includes(text)) ?? [];
    return row[row.map((cell) => cell.ch).join("").indexOf(text)];
  };
  const groundOf = (style: string): string => style.slice(style.indexOf(" on ") + 1);

  it.each(TEXT_COLOURS)("are written in %s's textColor on the section's fill", (theme, background, ink) => {
    const header = cellOf(theme, background, "Go to work")?.style ?? "";
    const task = cellOf(theme, background, "Make tea")?.style ?? "";
    expect(header.split(" ")).toContain(ink);
    expect(header).toContain(" on ");
    expect(groundOf(header)).toBe(groundOf(task));
  });

  it.each(["light", "dark"] as const)("keep mono's label ink on the fill, on a %s page", (background) => {
    const header = cellOf("mono", background, "Home")?.style ?? "";
    const title = cellOf("mono", background, "Day")?.style ?? "";
    const task = cellOf("mono", background, "Sit down")?.style ?? "";
    expect(header).toBe(`${title} ${groundOf(task)}`.trim());
  });
});
