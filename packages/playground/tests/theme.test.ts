import { describe, it, expect } from "vitest";
import { DARK_BACKGROUND, themeFamilies, twinOf, writeFrontmatterTheme } from "@tayomi/mermaid2term";
import { AVAILABLE_THEMES, pickedTheme } from "@/theme";

describe("the theme picker", () => {
  it("shows the family of a dark twin the source names, never a blank", () => {
    for (const family of themeFamilies()) {
      const source = writeFrontmatterTheme("graph TD\n  A --> B", twinOf(family, DARK_BACKGROUND));
      expect(AVAILABLE_THEMES, source).toContain(pickedTheme(source, "default"));
    }
  });

  it("shows the fallback when the source names no theme", () => {
    expect(pickedTheme("graph TD\n  A --> B", "forest")).toBe("forest");
  });
});
