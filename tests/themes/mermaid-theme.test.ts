import { describe, it, expect } from "vitest";
import { themeAsked } from "../../src/paint/frontmatter.js";
import { HOUSE } from "../../src/paint/catalogue.js";
import {
  CLASSIC_MERMAID_BLOCK,
  cssOfTheme,
  forMermaid,
  fromMermaidBlock,
  getTheme,
  readFrontmatterTheme,
  readMermaidTheme,
  renderThemed,
  themeFromCss,
  writeFrontmatterTheme,
  writeMermaidTheme,
} from "../../src/index.js";
import { withConfig } from "../support/frontmatter.js";

const BARE = "graph TD\n    A --> B\n";
const WITH_CONFIG = withConfig({ look: "neo" }, "graph TD\n    A --> B\n");
const WITH_THEME = withConfig({ theme: "forest" }, "graph TD\n    A --> B\n");
const AT_ROOT = "---\ntitle: Hop\ntheme: 'neon'\n---\ngraph TD\n    A --> B\n";

describe("classic, declared in mermaid's language", () => {
  it("reads back as the theme it always was: colours off the variables, weights and arrowhead off the CSS", () => {
    const classic = getTheme("classic");
    expect(classic.node).toBe("cyan");
    expect(classic.edge).toBe("dim white");
    expect(classic.arrow).toBe("bold yellow");
    expect(classic.label).toBe("bold white");
    expect(classic.edgeLabel).toBe("italic dim");
    expect(classic.subgraph).toBe("dim cyan");
    expect(classic.subgraphLabel).toBe("bold cyan");
    expect(classic.variables.m2t_edgeLabelColor).toBeUndefined();
    expect(classic.sectionColors[0]).toBe("#14385C");
    const read = readMermaidTheme(CLASSIC_MERMAID_BLOCK);
    expect(read.theme).toBe("base");
    expect(read.css).toContain(".marker { fill: yellow; stroke: yellow; }");
    expect(read.variables.get("primaryColor")).toBe("cyan");
  });

  it("is the same theme whether read from the table or from the block by any other name, on the house ground", () => {
    const again = fromMermaidBlock("again", CLASSIC_MERMAID_BLOCK, HOUSE);
    const classic = getTheme("classic");
    expect({ ...again, name: "classic" }).toEqual(classic);
  });
});

describe("themeCSS read off a source's frontmatter", () => {
  it("recolours the arrowheads and reweighs the roles it styles, leaving the others to the theme", () => {
    const source =
      withConfig({ theme: "mono", themeCSS: '".marker { fill: #ff0000; } .edgeLabel { font-weight: bold; }"' }, "flowchart LR\n  A -->|hop| B\n");
    const drawn = renderThemed(source, {}, "mono");
    expect(drawn).toContain("38;2;255;0;0");
    const { weights, colours } = themeFromCss(".marker { fill: #ff0000; } .edgeLabel { font-weight: bold; }");
    expect(colours.arrowheadColor).toBe("#ff0000");
    expect(weights.edgeLabel).toBe("bold");
    expect(weights.edge).toBeUndefined();
  });

  it("reads a participant's frame, fill and lifeline off `.actor` and `.actor-line`, as mermaid's own stylesheet names them", () => {
    const { colours } = themeFromCss(".actor { stroke: #9370db; fill: #ececff; } .actor-line { stroke: #9370db; }");
    expect(colours).toEqual({ actorBorder: "#9370db", actorBkg: "#ececff", actorLineColor: "#9370db" });
    const block =
      'theme: base\nthemeCSS: ".actor { stroke: #111111; fill: #222222; } .actor-line { stroke: #333333; }"\nthemeVariables:\n  actorBorder: "#abcdef"\n';
    const theme = fromMermaidBlock("styled", block);
    expect(theme.variables.actorBorder).toBe("#abcdef");
    expect(theme.variables.actorBkg).toBe("#222222");
    expect(theme.variables.actorLineColor).toBe("#333333");
  });

  it("reads how much of its ink a block's frame keeps off `.loopLine { opacity }`, and writes it back the same way", () => {
    const { frameOpacity } = themeFromCss(".loopLine { opacity: 0.7; stroke-dasharray: 2, 2; }");
    expect(frameOpacity).toBe(0.7);
    expect(themeFromCss(".loopLine { stroke: red; }").frameOpacity).toBeUndefined();
    const theme = fromMermaidBlock("framed", 'theme: base\nthemeCSS: ".loopLine { opacity: 0.7; }"\nthemeVariables:\n  primaryColor: "#336699"\n');
    expect(theme.frameOpacity).toBe(0.7);
    const weights = { node: "", edge: "", arrow: "", label: "", edgeLabel: "", subgraph: "", subgraphLabel: "" };
    expect(cssOfTheme(weights, undefined, 0.7)).toBe(".loopLine { opacity: 0.7; }");
    expect(cssOfTheme(weights, undefined)).toBe("");
  });

  it("ignores CSS meant for mermaid alone, and !important with it", () => {
    const { weights, colours } = themeFromCss(
      ".node rect { filter: drop-shadow(0 0 2px black) !important; } @media print { .marker { fill: red; } } .marker { fill: green !important; }"
    );
    expect(colours.arrowheadColor).toBe("green");
    expect(Object.keys(weights)).toHaveLength(0);
  });

  it("writes weights back as typography mermaid renders, and reads them again unchanged", () => {
    const weights = { node: "", edge: "dim", arrow: "bold", label: "bold", edgeLabel: "italic dim", subgraph: "dim", subgraphLabel: "bold" };
    const css = cssOfTheme(weights, "yellow");
    const back = themeFromCss(css);
    expect(back.colours.arrowheadColor).toBe("yellow");
    expect(back.weights).toEqual({ edge: "dim", edgeLabel: "italic dim", label: "bold", subgraph: "dim", subgraphLabel: "bold" });
  });
});

describe("the theme a source names, read and written in its frontmatter", () => {
  it("reads it under config: alone, mermaid reading no theme at the root, and nothing where there is none", () => {
    expect(readFrontmatterTheme(WITH_THEME)).toBe("forest");
    expect(readFrontmatterTheme(AT_ROOT)).toBeUndefined();
    expect(readFrontmatterTheme("---\nconfig:\n  theme: 'neon'\n---\n" + BARE)).toBe("neon");
    expect(readFrontmatterTheme(WITH_CONFIG)).toBeUndefined();
    expect(readFrontmatterTheme(BARE)).toBeUndefined();
  });

  it("writes a whole frontmatter ahead of a source that has none", () => {
    expect(writeFrontmatterTheme(BARE, "redux")).toBe(withConfig({ theme: "redux" }, "graph TD\n    A --> B\n"));
  });

  it("slides the line under an existing config:, changes an existing theme: in place, opens a config: where missing", () => {
    expect(writeFrontmatterTheme(WITH_CONFIG, "mono")).toBe("---\nconfig:\n  theme: mono\n  look: neo\n---\ngraph TD\n    A --> B\n");
    expect(writeFrontmatterTheme(WITH_THEME, "dracula")).toBe("---\nconfig:\n  theme: dracula\n---\ngraph TD\n    A --> B\n");
    expect(writeFrontmatterTheme(AT_ROOT, "mono")).toBe("---\nconfig:\n  theme: mono\ntitle: Hop\ntheme: 'neon'\n---\ngraph TD\n    A --> B\n");
    expect(writeFrontmatterTheme("---\ntitle: Hop\n---\n" + BARE, "neo")).toBe("---\nconfig:\n  theme: neo\ntitle: Hop\n---\n" + BARE);
  });

  it("is idempotent", () => {
    const once = writeFrontmatterTheme(BARE, "redux");
    expect(writeFrontmatterTheme(once, "redux")).toBe(once);
  });
});

describe("the source mermaid should read", () => {
  it("names the twin of the side where mermaid knows the name", () => {
    expect(readFrontmatterTheme(forMermaid(writeFrontmatterTheme(BARE, "redux"), "mono", "dark", "#000000"))).toBe("redux-dark");
    expect(readFrontmatterTheme(forMermaid(writeFrontmatterTheme(BARE, "redux"), "mono", "light", "#ffffff"))).toBe("redux");
    expect(readFrontmatterTheme(forMermaid(WITH_THEME, "mono", "dark", "#000000"))).toBe("forest");
  });

  it("writes classic whole, mermaid's way: base, the CSS for arrowheads and weights, the variables in the terminal's hex", () => {
    const out = forMermaid(writeFrontmatterTheme(BARE, "classic"), "mono", "dark", "#0A0A0A");
    expect(readFrontmatterTheme(out)).toBe("base");
    expect(out).toContain('  themeCSS: ".marker { fill: #BBBB00; stroke: #BBBB00; }');
    expect(out).toContain(".flowchart-link { opacity: 0.6; }");
    expect(out).toContain('    primaryColor: "#00BBBB"');
    expect(out).toContain('    lineColor: "#FFFFFF"');
    expect(out).toContain('    background: "#0A0A0A"');
    expect(out).toContain('    darkMode: "true"');
    expect(out.endsWith(BARE)).toBe(true);
    const drawn = renderThemed(out, {}, "mono");
    expect(drawn).toContain("38;2;187;187;0");
    expect(drawn).toContain("48;2;10;10;10");
    expect(drawn).toContain("38;2;0;187;187");
  });

  it("hands mermaid the mirrored classic on the light side, never white on its white page", () => {
    const out = forMermaid(writeFrontmatterTheme(BARE, "classic"), "mono", "light", "#FFFFFF");
    expect(out).toContain('    textColor: "#000000"');
    expect(out).toContain('    lineColor: "#000000"');
    expect(out).not.toContain('    textColor: "#FFFFFF"');
  });

  it("rewrites rather than doubles when written twice", () => {
    const once = forMermaid(writeFrontmatterTheme(BARE, "classic"), "mono", "dark", "#0A0A0A");
    const twice = writeMermaidTheme(once, getTheme("classic"), "#0A0A0A");
    expect(twice.match(/themeCSS:/gu)).toHaveLength(1);
    expect(twice.match(/themeVariables:/gu)).toHaveLength(1);
  });

  it("gives mermaid the theme of the side for a theme neither mermaid's nor declared", () => {
    const source = writeFrontmatterTheme(BARE, "terra");
    expect(readFrontmatterTheme(forMermaid(source, "mono", "dark", "#000000"))).toBe("dark");
    expect(readFrontmatterTheme(forMermaid(source, "mono", "light", "#ffffff"))).toBe("default");
  });
});

describe("the two doors onto one mermaid theme declaration, which read it the same way", () => {
  const CSS = ".actor { fill: #123456; stroke: #654321; } .activation0 { fill: #abcdef; } .loopLine { opacity: 0.3; }";
  const block = fromMermaidBlock("probe", `theme: base\nthemeCSS: "${CSS}"\n`);
  const front = themeAsked(withConfig({ theme: "base", themeCSS: `"${CSS}"` }, "graph TD\n    A --> B\n"), "base");

  it("gives a participant the colours the stylesheet names, whichever door the declaration came through", () => {
    for (const key of ["actorBkg", "actorBorder", "actorLineColor", "activationBkgColor"] as const) {
      expect([key, front.variables[key]]).toEqual([key, block.variables[key]]);
    }
  });

  it("gives a frame the opacity the stylesheet names, whichever door it came through", () => {
    expect(front.frameOpacity).toBe(0.3);
    expect(block.frameOpacity).toBe(0.3);
  });
});

describe("a source pasted with a margin, which the theme block must not stand behind", () => {
  it("opens the fence on the first column where the source is indented, mermaid reading no frontmatter behind whitespace", () => {
    const indented = "    sequenceDiagram\n        A->>B: hi\n";
    expect(writeFrontmatterTheme(indented, "mono")).toBe(withConfig({ theme: "mono" }, "sequenceDiagram\n        A->>B: hi\n"));
    expect(forMermaid(indented, "mono", "dark", "#0A0A0A").startsWith("---\n")).toBe(true);
    expect(forMermaid("\n\ngraph TD\n A --> B\n", "mono", "light", "#FFFFFF").startsWith("---\n")).toBe(true);
  });
});
