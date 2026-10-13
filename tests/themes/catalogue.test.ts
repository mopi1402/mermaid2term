import { describe, it, expect } from "vitest";
import { mermaidVariablesOf, themeVariablesFrom } from "../../src/paint/themes.js";
import { isDarkTwin, printToConsole, renderThemed, renderThemedText, themeFamilies } from "../../src/index.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../support/sources.js";
import { THEMES, getTheme } from "../../src/paint/catalogue.js";
import { withConfig } from "../support/frontmatter.js";

describe("mermaid's own eleven, carried over so a diagram written for mermaid finds the theme it names", () => {
  const MERMAID = [
    "base", "dark", "default", "forest", "neutral", "neo",
    "neo-dark", "redux", "redux-dark", "redux-color", "redux-dark-color",
  ];

  it("answers to every one of mermaid's names, rather than falling back to the default on all eleven", () => {
    for (const name of MERMAID) expect(getTheme(name).name).toBe(name);
  });

  it("leaves this package's own eleven answering beside them, neither catalogue shadowing the other", () => {
    const ours = ["mono", "classic", "terra", "neon", "amber", "phosphor", "gruvbox", "monokai", "dracula", "nord", "solarized"];
    for (const name of ours) expect(getTheme(name).name).toBe(name);
    expect(THEMES.size).toBe(ours.length + MERMAID.length);
  });

  it("gives `default` to mermaid, the one name both catalogues had, and keeps the cyan one as `classic`", () => {
    expect(getTheme("default").variables.primaryColor).toBe("#ECECFF");
    expect(getTheme("default").variables.background).toBe("#FFFFFF");
    expect(getTheme("classic").variables.primaryColor).toBe("cyan");
  });

  it("carries mermaid's own values, not colours chosen to look like them", () => {
    expect(getTheme("forest").variables.primaryColor).toBe("#CDE498");
    expect(getTheme("dark").variables.primaryColor).toBe("#1F2020");
    expect(getTheme("default").variables.taskBkgColor).toBe("#8A90DD");
    expect(getTheme("default").variables.critBkgColor).toBe("#FF0000");
    expect(getTheme("default").variables.doneTaskBkgColor).toBe("#D3D3D3");
  });

  it("computes on the LIGHT branch throughout, mermaid 11.17.0 never setting `darkMode` on a theme at all", () => {
    for (const name of MERMAID) expect(getTheme(name).variables.darkMode).toBe(false);
  });

  it("is reachable from a source that names one, which is the whole point of carrying them", () => {
    const gantt = "gantt\n    dateFormat YYYY-MM-DD\n    section S\n        Now :a, 2026-01-01, 5d\n";
    const drawn = renderThemed(withConfig({ theme: "forest" }, gantt), { width: 60 });
    expect(drawn).not.toBe(renderThemed(gantt, { width: 60 }));
    expect(drawn).not.toContain("48;2;255;255;255");
  });
});

describe("the families a chooser lists, one name per pair", () => {
  it("folds the dark half of each pair into the light one and keeps every other name", () => {
    const families = themeFamilies();
    expect(families).toHaveLength(THEMES.size - 4);
    for (const dark of ["dark", "neo-dark", "redux-dark", "redux-dark-color"]) expect(families).not.toContain(dark);
    for (const kept of ["mono", "classic", "default", "neo", "redux", "redux-color", "forest", "dracula"]) {
      expect(families).toContain(kept);
    }
    expect(isDarkTwin("redux-dark")).toBe(true);
    expect(isDarkTwin("dracula")).toBe(false);
  });
});

describe("the chooser's own list, which has to name every theme the package ships", () => {
  it("gives each theme of `THEMES` a line in the CLI's notes table", () => {
    const listing = readFileSync(join(ROOT, "src/cli/theme-list.ts"), "utf8");
    const notes = listing.slice(listing.indexOf("const THEME_NOTES"));
    const missing = [...THEMES.keys()].filter((name) => !notes.includes(`["${name}", "`));
    expect(missing).toEqual([]);
  });
});

describe("the theme EXTENDED, and still a mermaid theme: mermaid's own name where it has one, ours where it has none", () => {
  const said = (pairs: Record<string, string>): ReadonlyMap<string, string> => new Map(Object.entries(pairs));
  const painted = (source: string): string[] => [
    ...new Set(printToConsole(renderThemedText(source, { width: 50 }), 200).match(/\[[0-9;]*m/gu) ?? []),
  ];
  const headed = (vars: string, body: string): string =>
    withConfig(`  theme: base\n  themeVariables:\n${vars}`, body);
  const QUADRANT = "quadrantChart\n  title T\n  x-axis Low --> High\n  y-axis Low --> High\n  A: [0.3, 0.6]\n";
  // A timeline's band reads `cScaleLabel`; a kanban column's title is mermaid's `textColor`.
  const TIMELINE = "timeline\n  section S\n    p : e\n";

  it("reads `cScaleLabel0` as the ink OVER band 0 and never as the band itself", () => {
    const read = themeVariablesFrom(said({ cScaleLabel0: "#ff0000" }));
    expect(read.cScaleLabel?.[0]).toBe("#ff0000");
    expect(read.cScale).toBeUndefined();
  });

  it("reads mermaid's `scaleLabelColor` as the fallback of every band label a theme file reads it for", () => {
    const read = themeVariablesFrom(said({ scaleLabelColor: "#00ff00", cScaleLabel3: "#123456" }));
    expect(read.scaleLabelColor).toBe("#00ff00");
    expect(getTheme("base", read).variables.cScaleLabel).toEqual(Array.from({ length: 12 }, (_, at) => (at === 3 ? "#123456" : "#00ff00")));
    // `theme-default.js` labels its bands off `labelTextColor` and never reads it.
    expect(getTheme("default", read).variables.cScaleLabel[0]).toBe(getTheme("default").variables.cScaleLabel[0]);
  });

  it("writes the scale labels back out under mermaid's own numbering", () => {
    const theme = getTheme("base", themeVariablesFrom(said({ cScaleLabel2: "#123456" })));
    expect(mermaidVariablesOf(theme, "#000000").cScaleLabel2).toBe("#123456");
  });

  it("keeps a theme that names NEITHER drawn exactly as this layer always drew it", () => {
    // base states mermaid's `cScaleLabel` #333, weighed up to read on the band.
    expect(painted(headed('    primaryColor: "#336699"\n', TIMELINE))).toContain("[1;38;2;110;110;110;48;2;19;38;57m");
  });

  it("paints a quadrant chart from mermaid's own quadrant variables, derived off the primary colour", () => {
    const own = painted(headed('    primaryColor: "#336699"\n', QUADRANT));
    expect(own.some((sgr) => sgr.includes("48;2;51;102;153"))).toBe(true);
    expect(own.some((sgr) => sgr.includes("48;2;56;107;158"))).toBe(true);
  });

  it("writes a band's word in `cScaleLabel<N>` where the theme names one, weighed as it always was", () => {
    const own = painted(headed('    primaryColor: "#336699"\n    cScaleLabel0: "#ff0000"\n', TIMELINE));
    expect(own.some((run) => run.startsWith("[1;38;2;255;0;0;48;2;"))).toBe(true);
  });
});
