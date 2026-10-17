import { describe, it, expect } from "vitest";
import { TABS, placeOf } from "@/corpus";

describe("the tab a fixture opens on", () => {
  it("is the tab whose list holds it, for every fixture", () => {
    for (const family of TABS.all.families) {
      for (const fixture of family.sources) {
        const place = placeOf(fixture.name);
        const listed = TABS[place?.tab ?? "all"].families.find((one) => one.name === place?.family);
        expect(listed?.sources.map((one) => one.name), fixture.name).toContain(fixture.name);
      }
    }
  });

  it("is no tab at all for a name that is not a fixture", () => {
    expect(placeOf("flowchart/nowhere")).toBeUndefined();
    expect(placeOf(undefined)).toBeUndefined();
  });
});
