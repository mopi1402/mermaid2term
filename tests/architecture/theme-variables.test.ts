import { describe, expect, it } from "vitest";
import { renderThemed, type Background } from "../../src/index.js";
import { must } from "../../src/must.js";
import { hexOf, INK, runsOf, stripSgr } from "../support/ansi.js";
import { withConfig } from "../support/frontmatter.js";

const BODY = `architecture-beta
    group api(cloud)[API]
    service db(database)[Database] in api
    service server(server)[Server] in api
    service net(internet)[Gateway]
    db:R --> L:server
    server:R --> L:net
`;

const stating = (variables: Record<string, string>): string => {
  const said = Object.entries(variables).map(([name, value]) => `    ${name}: "${value}"`);
  return said.length === 0 ? BODY : withConfig(`  themeVariables:\n${said.join("\n")}\n`, BODY);
};

const inkOf = (drawn: string, found: (text: string) => boolean): string | undefined =>
  hexOf(must(runsOf(drawn).find(([, text]) => found(text)))[0], INK);

const line = (text: string): boolean => /^[─━]{2,}$/u.test(text);
const head = (text: string): boolean => text.includes("⏵");
const frame = (text: string): boolean => /[┌┏]/u.test(text);

// The edge's line, its head, the group's frame.
const inks = (drawn: string): Array<string | undefined> => [inkOf(drawn, line), inkOf(drawn, head), inkOf(drawn, frame)];

// mermaid 12's architecture stylesheet: `.edge { stroke: archEdgeColor }`, `.arrow { fill: archEdgeArrowColor }`,
// `.node-bkg { stroke: archGroupBorderColor }`; `base` states #777 and #000, the other themes the line and the
// primary border.
describe("an architecture diagram's own variables", () => {
  it.each([60, 100])("inks base's edges #777 and its group frames #000 (width %i)", (width) => {
    expect(inks(renderThemed(BODY, { width, background: "light" }, "base"))).toEqual(["#777777", "#777777", "#000000"]);
  });

  it.each([60, 100])("takes the values the source states (width %i)", (width) => {
    const drawn = renderThemed(stating({ archEdgeColor: "#aa3300", archEdgeArrowColor: "#0033aa", archGroupBorderColor: "#006600" }), { width, background: "light" }, "default");
    expect(inks(drawn)).toEqual(["#aa3300", "#0033aa", "#006600"]);
  });

  it.each([60, 100])("keeps the line and the primary border where nothing states them (width %i)", (width) => {
    const plain = renderThemed(BODY, { width, background: "light" }, "default");
    const flowchart = renderThemed("flowchart LR\n  subgraph g[G]\n    a --> b\n  end\n", { width, background: "light" }, "default");
    expect(inks(plain).slice(0, 2)).toEqual([inkOf(flowchart, line), inkOf(flowchart, head)]);
  });
});

// mermaid 12's `.edge { stroke-width: archEdgeWidth }` and `.node-bkg { stroke-width: archGroupBorderWidth;
// stroke-dasharray: 8 }`, 3 and 2px in every theme: heavy from 2 up, as any written width.
describe("an architecture diagram's widths", () => {
  it.each([60, 100])("draws mermaid's 3 wide edges and 2px dashed frames heavy (width %i)", (width) => {
    const drawn = stripSgr(renderThemed(BODY, { width, background: "light" }, "default"));
    expect(drawn).toMatch(/━{2,}⏵/u);
    expect(drawn.split("\n")[0]).toMatch(/^┏━ ━/u);
  });

  it.each([60, 100])("draws them light where the source writes 1 (width %i)", (width) => {
    const drawn = stripSgr(renderThemed(stating({ archEdgeWidth: "1", archGroupBorderWidth: "1px" }), { width, background: "light" }, "default"));
    expect(drawn).not.toMatch(/━/u);
    expect(drawn.split("\n")[0]).toMatch(/^┌─ ─/u);
  });
});

// mermaid 12's `.node-bkg { fill: none }`: a group stands on the page, `clusterBkg` or not.
describe("an architecture group's ground", () => {
  it.each([60, 100])("is the page, whatever clusterBkg says (width %i)", (width) => {
    const drawn = renderThemed(stating({ clusterBkg: "#f8f0fc" }), { width, background: "light" }, "default");
    expect(drawn).not.toMatch(/48;2;248;240;252/u);
  });
});

const REDUX: ReadonlyArray<[theme: string, background: Background, border: string]> = [
  ["redux", "light", "#171717"],
  ["redux-dark", "dark", "#cccccc"],
  ["redux-color", "light", "#171717"],
  ["redux-dark-color", "dark", "#cccccc"],
];

// mermaid 12's `redux-color` frames a group in the `mkBorder("#28253D")` its constructor states for
// `archGroupBorderColor`, `hsl(247.5, 0%, 9.2156862745%)`, #171717 as khroma's `toHex` rounds it.
describe("an architecture group under the redux themes", () => {
  it.each(REDUX)("is framed as mermaid does under %s", (theme, background, border) => {
    for (const width of [60, 100]) {
      expect(inkOf(renderThemed(BODY, { width, background }, theme), frame)).toBe(border);
    }
  });
});

const TITLES: ReadonlyArray<[theme: string, background: Background, ink: string]> = [
  ["default", "light", "#333333"],
  ["dark", "dark", "#cccccc"],
  ["forest", "light", "#000000"],
  ["neutral", "light", "#000000"],
  ["base", "light", "#333333"],
  ["neo", "light", "#333333"],
  ["neo-dark", "dark", "#cccccc"],
  ["redux", "light", "#28253d"],
  ["redux-dark", "dark", "#cccccc"],
  ["redux-color", "light", "#28253d"],
  ["redux-dark-color", "dark", "#cccccc"],
];

// Measured on mermaid 12 headless: a group's title is filled with `textColor` under every theme, never `titleColor`.
describe("an architecture group's title", () => {
  it.each(TITLES)("is inked as mermaid does under %s", (theme, background, ink) => {
    for (const width of [60, 100]) {
      expect(inkOf(renderThemed(BODY, { width, background }, theme), (text) => text.includes("API"))).toBe(ink);
    }
  });
});
