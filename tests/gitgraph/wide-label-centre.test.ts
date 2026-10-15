import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";
import { displayWidth } from "../../src/text/width.js";
import { NEWLINE } from "../../src/text/chars.js";

const WIDE = "開発開発開発";
const source = (direction: string): string => `gitGraph ${direction}:\n  commit id: "${WIDE}"\n`;

const columnOf = (line: string, text: string): number => displayWidth(line.slice(0, line.indexOf(text)));

describe("a wide-glyph label on the first branch is centred on its marker by columns, not code points", () => {
  it.each(["TB", "BT"])("%s", (direction) => {
    const lines = render(source(direction), { width: 80 }).split(NEWLINE);
    const label = lines.find((line) => line.includes(WIDE)) ?? "";
    const marker = lines.find((line) => line.includes("●")) ?? "";
    expect(columnOf(label, WIDE) + displayWidth(WIDE) / 2).toBe(columnOf(marker, "●"));
  });
});
