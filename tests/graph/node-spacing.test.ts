import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";
import { widestLine } from "../../src/text/width.js";
import { withConfig } from "../support/frontmatter.js";

const spaced = (section: string, keys: string, layout = "dagre"): string =>
  withConfig(`  layout: ${layout}\n  ${section}:\n${keys}\n`, "");

const FLOWCHART = (dir: string): string => `flowchart ${dir}\n  A --> B\n  A --> C\n  A --> D`;
const STATE = (dir: string): string => `stateDiagram-v2\n  direction ${dir}\n  A --> B\n  A --> C\n  A --> D`;
const ER = (dir: string): string => `erDiagram\n  direction ${dir}\n  A ||--o{ B : x\n  A ||--o{ C : y`;
const CLASS = (dir: string): string => `classDiagram\n  direction ${dir}\n  A <|-- B\n  A <|-- C`;

const rows = (drawn: string): number => drawn.split("\n").length;

// mermaid 12 under dagre: `nodeSpacing` between the boxes of a rank, `rankSpacing` between the ranks, in TD and LR alike.
describe.each(["TD", "LR"])("nodeSpacing and rankSpacing, in proportion to mermaid 12's default (%s)", (dir) => {
  const flowDir = dir === "TD" ? "TB" : dir;
  // The spacing that runs across the page sets the gap's columns, the other one adds rows.
  const across = dir === "TD" ? "nodeSpacing" : "rankSpacing";
  const down = dir === "TD" ? "rankSpacing" : "nodeSpacing";

  it("maps the spacing across the page to the gap: 10px one cell, 100px eight, the 50px default four", () => {
    const body = FLOWCHART(dir);
    expect(render(spaced("flowchart", `    ${across}: 10`) + body)).toBe(render(body, { gap: 1 }));
    expect(render(spaced("flowchart", `    ${across}: 100`) + body)).toBe(render(body, { gap: 8 }));
    expect(render(spaced("flowchart", `    ${across}: 50`) + body)).toBe(render(body));
  });

  it("adds a row for every 25px the spacing down the page takes past its default, the columns left alone", () => {
    const body = FLOWCHART(dir);
    const plain = render(body);
    const deeper = render(spaced("flowchart", `    ${down}: 100`) + body);
    expect(rows(deeper) - rows(plain)).toBe(dir === "TD" ? 2 : 4);
    expect(widestLine(deeper)).toBe(widestLine(plain));
    expect(render(spaced("flowchart", `    ${down}: 50`) + body)).toBe(plain);
  });

  it("leaves the rows as the arrows size them under the default: a row holds no less", () => {
    const body = FLOWCHART(dir);
    expect(render(spaced("flowchart", `    ${down}: 10`) + body)).toBe(render(body));
  });

  it("maps a state diagram's spacings over the same 50px defaults", () => {
    const body = STATE(flowDir);
    expect(render(spaced("state", `    ${across}: 10`) + body)).toBe(render(body, { gap: 1 }));
    expect(rows(render(spaced("state", `    ${down}: 100`) + body)) - rows(render(body))).toBe(dir === "TD" ? 2 : 4);
  });

  it("maps an ER diagram's spacings over its own 140px and 80px defaults", () => {
    const body = ER(flowDir);
    expect(render(spaced("er", "    nodeSpacing: 140\n    rankSpacing: 80") + body)).toBe(render(body));
    const deeper = render(spaced("er", `    ${down}: ${dir === "TD" ? 160 : 280}`) + body);
    expect(rows(deeper)).toBeGreaterThan(rows(render(body)));
    if (dir === "TD") expect(render(spaced("er", "    nodeSpacing: 35") + body)).toBe(render(body, { gap: 1 }));
    else expect(widestLine(render(spaced("er", "    rankSpacing: 400") + body))).toBeGreaterThan(widestLine(render(body)));
  });

  it("wins over the caller's gap across the page", () => {
    const body = FLOWCHART(dir);
    expect(render(spaced("flowchart", `    ${across}: 10`) + body, { gap: 8 })).toBe(render(body, { gap: 1 }));
  });

  it("leaves the caller's gap across the page when only the spacing down it is said", () => {
    const body = FLOWCHART(dir);
    expect(widestLine(render(spaced("flowchart", `    ${down}: 100`) + body, { gap: 8 }))).toBe(widestLine(render(body, { gap: 8 })));
  });

  it("is read from an init directive too", () => {
    const body = FLOWCHART(dir);
    const directive = `%%{init: {"layout": "dagre", "flowchart": {"${across}": 10}}}%%\n`;
    expect(render(directive + body)).toBe(render(body, { gap: 1 }));
  });

  it("says nothing under elk, mermaid 12's default layout, nor when the layout is left unsaid", () => {
    const body = FLOWCHART(dir);
    for (const key of [across, down]) {
      expect(render(spaced("flowchart", `    ${key}: 100`, "elk") + body)).toBe(render(body));
      expect(render(withConfig({ flowchart: { [key]: 100 } }, body))).toBe(render(body));
    }
  });

  it("says nothing to a class diagram, which mermaid 12 lays out alike whatever they say", () => {
    const body = CLASS(flowDir);
    expect(render(spaced("class", "    nodeSpacing: 10\n    rankSpacing: 100") + body)).toBe(render(body));
  });

  it("leaves a spacing written under another kind's name unread", () => {
    const body = FLOWCHART(dir);
    expect(render(spaced("state", `    ${across}: 10\n    ${down}: 100`) + body)).toBe(render(body));
  });
});
