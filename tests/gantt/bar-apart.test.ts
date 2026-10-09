import { describe, expect, it } from "vitest";
import { render, renderThemed } from "../../src/index.js";
import { THREE_PANES } from "../support/drawn.js";

const HEAD = "gantt\n    dateFormat YYYY-MM-DD\n    section S\n";
const rowWith = (drawn: string, word: string): string => drawn.split("\n").find((line) => line.includes(word)) ?? "";

describe("two bars of one ink on rows that touch never read as one block", () => {
  it.each(THREE_PANES)("stands the lower bar an eighth short where it meets one of its ink, width %i", (width) => {
    const drawn = render(HEAD + "    Auth :a1, 2026-05-04, 5d\n    Sync :a2, 2026-05-04, 8d\n    Push :a3, after a1, 4d\n", { width });
    expect(rowWith(drawn, "Auth"), drawn).toContain("█");
    expect(rowWith(drawn, "Auth"), drawn).not.toContain("▇");
    expect(rowWith(drawn, "Sync"), drawn).toMatch(/▇/u);
    expect(rowWith(drawn, "Sync"), drawn).not.toContain("█");
    expect(rowWith(drawn, "Push"), drawn).toMatch(/▇/u);
  });

  it("keeps a whole block under a bar of another ink, or under none", () => {
    const drawn = render(HEAD + "    Auth :crit, a1, 2026-05-04, 5d\n    Sync :a2, 2026-05-04, 8d\n    Late :a3, 2026-05-20, 4d\n", { width: 80 });
    expect(rowWith(drawn, "Sync"), drawn).toContain("█");
    expect(rowWith(drawn, "Late"), drawn).toContain("█");
    expect(drawn).not.toContain("▇");
  });

  it("inks the lowered bar as its own, the section's ground showing in its top eighth", () => {
    const row = rowWith(renderThemed(HEAD + "    Auth :a1, 2026-05-04, 5d\n    Sync :a2, 2026-05-04, 8d\n", { width: 80, background: "dark" }, "default"), "Sync");
    const whole = rowWith(renderThemed(HEAD + "    Auth :a1, 2026-05-04, 5d\n    Sync :a2, 2026-05-04, 8d\n", { width: 80, background: "dark" }, "default"), "Auth");
    const fg = (line: string, glyph: string): string | undefined => new RegExp(`38;2;(\\d+;\\d+;\\d+)[^m]*m${glyph}`, "u").exec(line)?.[1];
    expect(fg(row, "▇")).toBeDefined();
    expect(fg(row, "▇")).toBe(fg(whole, "█"));
  });
});
