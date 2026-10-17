// A name added to the wrong set in `shelves.ts` puts a showcase on the Real Life shelf, which these oracles catch.

import { describe, it, expect } from "vitest";
import { TABS } from "@/corpus";

const FRONTMATTER = "/frontmatter";

describe("the showcase shelf", () => {
  it("carries exactly one Frontmatter entry per kind, and it is the last of its shelf", () => {
    const families = TABS.showcase.families;
    expect(families.length).toBeGreaterThan(0);
    for (const family of families) {
      const found = family.sources.filter((one) => one.name.includes(FRONTMATTER));
      expect(found.map((one) => one.name), family.label).toHaveLength(1);
      expect(found[0].label, family.label).toBe("Frontmatter");
      expect(family.sources[family.sources.length - 1].name, family.label).toBe(found[0].name);
    }
  });

  it("keeps every Frontmatter fixture off the other two shelves", () => {
    for (const family of TABS.all.families) {
      const stray = family.sources.filter((one) => one.name.includes(FRONTMATTER) && one.shelf !== "showcase");
      expect(stray.map((one) => one.name), family.label).toEqual([]);
    }
  });

  it("gives each Frontmatter showcase a note of its own", () => {
    for (const family of TABS.showcase.families) {
      const found = family.sources.filter((one) => one.name.includes(FRONTMATTER));
      for (const one of found) expect(one.notes, one.name).not.toHaveLength(0);
    }
  });
});
