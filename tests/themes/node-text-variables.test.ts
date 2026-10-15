import { describe, expect, it } from "vitest";
import { renderThemedText } from "../../src/index.js";
import { withConfig } from "../support/frontmatter.js";

// mermaid 12 inks a flowchart, ER or block label in `nodeTextColor || textColor` and a class box's text in
// `classText`, which falls back on `primaryTextColor` (checked on its stylesheets and headless, 2026-09-28).
const styleOf = (source: string, word: string, theme = "default", background: "light" | "dark" = "light"): string => {
  const row = renderThemedText(source, { width: 80, background }, theme).rows.find((cells) => cells.map((cell) => cell.ch).join("").includes(word)) ?? [];
  const at = row.map((cell) => cell.ch).join("").indexOf(word);
  return row[at]?.style.toLowerCase() ?? "";
};
const headed = (variables: string, body: string): string => withConfig(`  themeVariables:\n${variables}`, body);

describe.each(["TB", "LR"])("a node's label ink, %s", (direction) => {
  const flow = `flowchart ${direction === "TB" ? "TD" : "LR"}\n  A[Order] --> B[Invoice]`;
  const er = `erDiagram\n  direction ${direction}\n  ORDER ||--o{ INVOICE : bills`;
  const block = `block-beta\n  columns ${direction === "TB" ? 1 : 2}\n  a["Order"] b["Invoice"]`;
  const cls = `classDiagram\n  direction ${direction}\n  class Order {\n    +int id\n  }`;

  it.each([[flow, "Order"], [er, "ORDER"], [block, "Order"]])("takes nodeTextColor where it is written: %s", (body, word) => {
    expect(styleOf(headed('    nodeTextColor: "#aa0000"\n', body), word)).toContain("#aa0000");
    expect(styleOf(body, word)).toContain("#333333");
  });

  it("inks a class box in classText, primaryTextColor when unwritten", () => {
    expect(styleOf(cls, "+int")).toContain("#131300");
    expect(styleOf(headed('    classText: "#0000aa"\n', cls), "+int")).toContain("#0000aa");
  });

  it("takes the values the dark modern themes write of their own", () => {
    expect(styleOf(flow, "Order", "redux-dark", "dark")).toContain("#e0dfdf");
    expect(styleOf(cls, "+int", "redux-dark", "dark")).toContain("#cccccc");
  });
});

describe.each([1, 2])("a block composite's title, %i column(s)", (columns) => {
  it("takes titleColor, as mermaid's `.cluster-label` does", () => {
    const body = `block-beta\n  columns ${columns}\n  block:group1["group1"]\n    a["Order"]\n  end`;
    expect(styleOf(headed('    titleColor: "#aa00aa"\n', body), "group1")).toContain("#aa00aa");
  });
});

describe.each(["TB", "LR"])("an ER relationship label's ground, %s", (direction) => {
  const er = `erDiagram\n  direction ${direction}\n  ORDER ||--o{ INVOICE : bills`;
  it("stands on erEdgeLabelBackground under redux-color alone, as mermaid's ER stylesheet reads it", () => {
    expect(styleOf(er, "bills", "redux-color")).toContain("on #ffffff");
    expect(styleOf(er, "bills", "redux")).not.toContain("on #ffffff");
    expect(styleOf(er, "bills", "redux-dark-color", "dark")).toContain("on #16141f");
  });
});
