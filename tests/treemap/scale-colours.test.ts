import { describe, expect, it } from "vitest";
import { renderThemedText } from "../../src/index.js";

// mermaid 12's treemap renderer keys three `ordinal` scales by name (checked headless on 2026-09-29): a section's
// rect is filled its `cScale` seat at 0.6 over what lies under it, the root's empty name taking a `transparent`
// seat first so the first section takes `cScale0`, sections met breadth first; a leaf is filled its parent's seat at
// 0.3 and stroked with it whole, a top-level leaf on `transparent`; every name and value is written its
// `cScaleLabel` seat, sections first, then the leaves in depth-first order.
const SOURCE = [
  "treemap-beta",
  '"Engine"',
  '    "Layout": 40',
  '    "Routing": 25',
  '    "Renderer"',
  '        "Canvas": 15',
  '        "Shapes": 10',
  '"Docs"',
  '    "Guides": 8',
  '    "Reference": 2',
  '"Loose": 30',
].join("\n");

type Ground = "light" | "dark";

describe.each([80, 100])("a treemap's scale colours at width %i", (width) => {
  const styleOf = (theme: string, background: Ground, word: string): string => {
    const rows = renderThemedText(SOURCE, { width, background }, theme).rows;
    for (const row of rows) {
      const text = row.map((cell) => cell.ch).join("");
      const at = text.indexOf(word);
      if (at !== -1) return row[at].style;
    }
    return "";
  };

  it("fills each section its cScale seat by name under redux-color, nested sections over their parent", () => {
    expect(styleOf("redux-color", "light", "Engine")).toBe("bold #28253D on #F8CBFF");
    expect(styleOf("redux-color", "light", "Docs")).toBe("bold #28253D on #90F4E6");
    expect(styleOf("redux-color", "light", "Renderer")).toBe("bold #28253D on #FCC0A6");
  });

  it("fills a leaf its parent's seat once more, and writes its value in the same ink", () => {
    expect(styleOf("redux-color", "light", "Layout")).toBe("bold #28253D on #F7C1FF");
    expect(styleOf("redux-color", "light", "40")).toBe("italic #28253D on #F7C1FF");
    expect(styleOf("redux-color", "light", "Canvas")).toBe("bold #28253D on #FDBE94");
  });

  it("leaves a top-level leaf on the page, as mermaid's transparent seat", () => {
    expect(styleOf("redux-color", "light", "Loose")).toBe("bold #28253D");
  });

  it("seats the names of redux-dark-color by name, sections first, then the leaves", () => {
    expect(styleOf("redux-dark-color", "dark", "Engine")).toContain("#230029 on");
    expect(styleOf("redux-dark-color", "dark", "Layout")).toContain("#1A0032 on");
  });

  it("grounds redux's sections on #BFBFBF and redux-dark's on its near-black seats", () => {
    expect(styleOf("redux", "light", "Engine")).toBe("bold #28253D on #D9D9D9");
    expect(styleOf("redux-dark", "dark", "Docs")).not.toBe(styleOf("redux-dark", "dark", "Engine"));
  });
});
