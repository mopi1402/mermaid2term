import { describe, expect, it } from "vitest";
import { renderThemed } from "../../src/index.js";

const SOURCE = "journey\n  section Work\n    Make tea: 5: Me\n  section Home\n    Sit down: 2: Cat\n";
const TEXT = "38;2;51;51;51";

const codeBefore = (out: string, word: string): string | undefined => new RegExp(`\\[([0-9;]*)m${word}`, "u").exec(out)?.[1];

// mermaid 12's journey sheet: a task's name is its `.label` div's `textColor`, an actor's legend name `.legend`'s,
// and `line { stroke: textColor }` draws the axis; `default` states #333333.
describe("a journey's task names, legend and axis are in textColor, as mermaid", () => {
  const out = renderThemed(SOURCE, { width: 80, background: "light" }, "default");

  it("writes every task's name in textColor, whatever its section", () => {
    expect(codeBefore(out, "Make")).toMatch(new RegExp(`${TEXT}(;|$)`, "u"));
    expect(codeBefore(out, "Sit")).toMatch(new RegExp(`${TEXT}(;|$)`, "u"));
  });

  it("writes each actor's legend name in textColor, its mark kept in the actor's own colour", () => {
    expect(codeBefore(out, "Cat")).toMatch(new RegExp(`${TEXT}$`, "u"));
    expect(codeBefore(out, "Me")).toMatch(new RegExp(`${TEXT}$`, "u"));
    expect(codeBefore(out, "●")).not.toMatch(new RegExp(TEXT, "u"));
  });

  it("draws the axis and its arrow in textColor", () => {
    expect(out).toMatch(new RegExp(`\\[${TEXT}m─*⏵`, "u"));
  });
});
