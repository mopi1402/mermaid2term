import { describe, it, expect } from "vitest";
import { render } from "../../src/index.js";

const ARROWS = ["->>", "-->>", "->", "-->", "-x", "--x", "-)", "--)", "<<->>", "<<-->>", "-|\\", "--|/", "-\\\\", "--//", "/|-", "\\\\--"];

describe("a blank after the activation marker `+` or `-`, kept out of the recipient's id", () => {
  it("draws `Alice ->>+ John` then `John -->>- Alice` as two columns, the band opening at hi and closing at ho", () => {
    const rows = render("sequenceDiagram\nAlice ->>+ John: hi\nJohn -->>- Alice: ho\n", { width: 80 }).split("\n");
    expect(rows.slice(0, 3).join("\n")).toBe(
      "╭─────────╮     ╭────────╮\n│  Alice  │     │  John  │\n╰─────────╯     ╰────────╯"
    );
    expect(rows.findIndex((row) => row.includes("╖"))).toBe(rows.findIndex((row) => row.includes("⏵")));
    expect(rows.findIndex((row) => row.includes("╜"))).toBe(rows.findIndex((row) => row.includes("⏴")));
  });

  it.each(ARROWS.flatMap((arrow) => [[arrow, "+"], [arrow, "-"]]))(
    "reads `Alice %s%s  John` as its tight spelling",
    (arrow, marker) => {
      const loose = `sequenceDiagram\nAlice ->>+ John: open\nAlice ${arrow}${marker}  John: m\n`;
      const tight = `sequenceDiagram\nAlice ->>+John: open\nAlice${arrow}${marker}John: m\n`;
      expect(render(loose, { width: 80 })).toBe(render(tight, { width: 80 }));
    }
  );
});
