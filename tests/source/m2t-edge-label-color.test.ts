import { describe, expect, it } from "vitest";
import { renderThemedText } from "../../src/index.js";

// A packet with one field over the whole row: its bit numbers, `0` and `31`, are drawn in the house secondary ink.
const source = (key: string, body: string): string => `---
config:
  themeVariables:
    ${key}: "#aa0000"
---
${body}`;

const PACKET = "packet-beta\n    0-31: \"Header\"";
const FLOWCHART = (direction: string): string => `flowchart ${direction}\n  A -->|hop| B`;

const inkOf = (text: ReturnType<typeof renderThemedText>, word: string): string | undefined => {
  for (const row of text.rows) {
    const at = row.map((cell) => cell.ch).join("").indexOf(word);
    if (at !== -1) return /#[0-9a-f]{6}/iu.exec(row[at]?.style ?? "")?.[0].toLowerCase();
  }
  return undefined;
};
const drawn = (text: string): ReturnType<typeof renderThemedText> => renderThemedText(text, { width: 80, background: "light" }, "default");

// A key of our own, mermaid has no `edgeLabelColor`: `m2t_edgeLabelColor` inks a packet's bit numbers, the bare name
// is read no more, and no graph edge label reads either.
describe("m2t_edgeLabelColor", () => {
  it("inks a packet's bit numbers", () => {
    expect(inkOf(drawn(source("m2t_edgeLabelColor", PACKET)), "31")).toBe("#aa0000");
  });

  it("is not read under mermaid's namespace", () => {
    expect(inkOf(drawn(source("edgeLabelColor", PACKET)), "31")).not.toBe("#aa0000");
  });

  it.each(["TD", "LR"])("reaches no flowchart edge label (%s)", (direction) => {
    expect(inkOf(drawn(source("m2t_edgeLabelColor", FLOWCHART(direction))), "hop")).not.toBe("#aa0000");
  });
});
