import { describe, expect, it } from "vitest";
import { renderThemed } from "../../src/index.js";

const frontmatter = (compact: boolean, stated: string): string => {
  const said = `${compact ? "displayMode: compact\n" : ""}${stated === "" ? "" : `config:\n  themeVariables:\n    taskTextClickableColor: "${stated}"\n`}`;
  return said === "" ? "" : `---\n${said}---\n`;
};

const source = (compact: boolean, stated: string): string => `${frontmatter(compact, stated)}gantt
  dateFormat YYYY-MM-DD
  section S
  Linked :a, 2026-03-02, 20d
  Called :b, 2026-03-02, 1d
  Plain :c, 2026-03-02, 20d
  click a href "https://example.org"
  click b call run()
`;

const runs = (text: string): Array<[string, string]> => [...text.matchAll(/\x1b\[([0-9;]*)m([^\x1b]+)/gu)].map((m) => [m[1], m[2]]);

const hex = (codes: string): string | undefined => {
  const m = /38;2;(\d+);(\d+);(\d+)/u.exec(codes) ?? undefined;
  return m === undefined ? undefined : `#${[m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, "0")).join("")}`;
};

// Every run that writes the name, its ink and whether it is bold.
const worn = (drawn: string, name: string): Array<[string | undefined, boolean]> =>
  runs(drawn)
    .filter(([, text]) => text.includes(name))
    .map(([codes]) => [hex(codes), codes.split(";").includes("1")]);

// mermaid 12's `.taskText.clickable`, `.taskTextOutsideLeft.clickable` and `.taskTextOutsideRight.clickable`: bold, in
// `taskTextClickableColor`, #003163 in every theme, for a task named by a `click` line, a link or a callback alike.
describe("a clickable gantt task's name", () => {
  const cases = [false, true].flatMap((compact) => [60, 100].map((width) => [compact, width] as const));

  it.each(cases)("is bold in taskTextClickableColor, a link or a callback alike (compact %s, width %i)", (compact, width) => {
    const drawn = renderThemed(source(compact, ""), { width, background: "light" }, "default");
    for (const name of ["Linked", "Called"]) {
      const names = worn(drawn, name);
      expect(names.length).toBeGreaterThan(0);
      for (const [ink, bold] of names) expect([ink, bold]).toEqual(["#003163", true]);
    }
    for (const [ink] of worn(drawn, "Plain")) expect(ink).not.toBe("#003163");
  });

  it.each(cases)("takes the value the source states (compact %s, width %i)", (compact, width) => {
    const drawn = renderThemed(source(compact, "#7a0000"), { width, background: "light" }, "default");
    for (const [ink, bold] of worn(drawn, "Linked")) expect([ink, bold]).toEqual(["#7a0000", true]);
  });
});
