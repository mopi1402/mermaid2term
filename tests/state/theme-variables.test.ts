import { describe, expect, it } from "vitest";
import { renderThemedText } from "../../src/index.js";

// mermaid 12's `stateDiagram` stylesheet reads its own variables before the generic ones (checked on its
// `styles.ts` and its resolved `getConfig()`, 2026-09-28).
const WRITTEN = `---
config:
  themeVariables:
    stateBkg: "#ffd6d6"
    stateBorder: "#e03131"
    stateLabelColor: "#b00000"
    transitionColor: "#00aa00"
    transitionLabelColor: "#0000aa"
    specialStateColor: "#aa00aa"
    innerEndBackground: "#00aaaa"
---
`;
const body = (direction: string): string => `stateDiagram-v2\n  direction ${direction}\n  [*] --> Order\n  Order --> Paid : settle\n  Paid --> [*]`;

type Cell = { readonly ch: string; readonly style: string; readonly owner?: string };
const cells = (source: string, theme = "default"): Cell[] =>
  renderThemedText(source, { width: 80, background: "light" }, theme).rows.flat();
const styleOf = (all: Cell[], pick: (cell: Cell) => boolean): string => all.find(pick)?.style.toLowerCase() ?? "";
const wordStyle = (all: Cell[], ch: string): string => styleOf(all, (cell) => cell.ch === ch);

describe.each(["TB", "LR"])("a state diagram's own theme variables, %s", (direction) => {
  it("each one reaches what it paints", () => {
    const all = cells(WRITTEN + body(direction));
    expect(wordStyle(all, "O")).toContain("#b00000 on #ffd6d6");
    // Under the `neo` look a state's wall is `nodeBorder`, its `stateBorder` outranked: mermaid 12 draws it so (2026-10-18).
    expect(styleOf(all, (cell) => cell.owner?.startsWith("node") === true && /[│╭╮╰╯]/u.test(cell.ch))).toContain("#9370db");
    expect(styleOf(all, (cell) => cell.owner === "edge")).toContain("#00aa00");
    expect(wordStyle(all, "s")).toContain("#0000aa");
    expect(styleOf(all, (cell) => cell.owner === "state_special")).toContain("#aa00aa");
    expect(styleOf(all, (cell) => cell.owner === "state_end")).toContain("#00aaaa");
  });

  it("falls back as mermaid's themes do: the name on primaryTextColor, the start dot on the line", () => {
    const all = cells(body(direction));
    expect(wordStyle(all, "O")).toContain("#131300");
    expect(styleOf(all, (cell) => cell.owner === "state_special")).toContain("#333333");
    expect(styleOf(all, (cell) => cell.owner === "state_end")).toContain("#9370db");
  });

  it("takes the values a theme writes of its own: neutral's transitions, dark's start dot", () => {
    expect(styleOf(cells(body(direction), "neutral"), (cell) => cell.owner === "edge")).toContain("#000000");
    const dark = renderThemedText(body(direction), { width: 80, background: "dark" }, "dark").rows.flat();
    expect(styleOf(dark, (cell) => cell.owner === "state_special")).toContain("#f4f4f4");
  });
});
