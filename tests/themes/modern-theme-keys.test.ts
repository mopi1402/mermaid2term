import { describe, expect, it } from "vitest";
import { renderThemed } from "../../src/index.js";
import { getTheme } from "../../src/paint/catalogue.js";

const GANTT = `gantt
  dateFormat YYYY-MM-DD
  section Build
  Plain task   :a, 2026-03-02, 3d
  Done task    :done, b, after a, 2d
`;

const SEQUENCE = `sequenceDiagram
  rect
    A->>B: hi
  end
`;

const stating = (key: string, value: string, source: string): string =>
  `%%{init: {"themeVariables": {"${key}": "${value}"}}}%%\n${source}`;

// Resolved by mermaid 12.0.0 (`getConfig().themeVariables` and the painted fills, checked headless on 2026-09-29).
describe("the modern themes resolve their keys as mermaid 12 does", () => {
  it("borders redux-color in #171717, mkBorder of #28253D", () => {
    expect(getTheme("redux-color").variables.primaryBorderColor).toBe("#171717");
  });

  it.each(["neo", "redux", "redux-color"])("grounds an uncoloured rect of %s on #F5F5F5, its page darkened by four", (theme) => {
    expect(getTheme(theme).variables.rectBkgColor).toBe("#F5F5F5");
  });

  it("fills a done task of neo-dark with its secondBkg #584343", () => {
    expect(getTheme("neo-dark").variables.doneTaskBkgColor).toBe("#584343");
  });
});

describe.each([80, 120])("drawn at width %i", (width) => {
  const drawn = (theme: string, source: string): string => renderThemed(source, { width }, theme);

  it.each(["neo", "redux", "redux-color"])("a sequence rect of %s stands on #F5F5F5, not on the white tertiary", (theme) => {
    expect(drawn(theme, SEQUENCE)).toBe(drawn(theme, stating("rectBkgColor", "#F5F5F5", SEQUENCE)));
    expect(drawn(theme, SEQUENCE)).not.toBe(drawn(theme, stating("rectBkgColor", "#FFFFFF", SEQUENCE)));
  });

  it("a done bar of neo-dark is filled off #584343, not the light grey", () => {
    expect(drawn("neo-dark", GANTT)).toBe(drawn("neo-dark", stating("doneTaskBkgColor", "#584343", GANTT)));
    expect(drawn("neo-dark", GANTT)).not.toBe(drawn("neo-dark", stating("doneTaskBkgColor", "#D3D3D3", GANTT)));
  });
});
