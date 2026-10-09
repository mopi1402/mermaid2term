import { describe, it, expect } from "vitest";
import { render, renderThemed, renderThemedText } from "../../src/index.js";
import { styleCodes } from "../../src/paint/sgr.js";
import type { Background } from "../../src/colour/background.js";
import { must } from "../../src/must.js";
import { stripSgr } from "../support/ansi.js";

const styleCodesOf = (definition: string, side: Background): string => styleCodes(definition, side);

const SOURCE = "flowchart LR\n    A[un] --> B[deux]\n";

describe("the side a drawing is painted onto", () => {
  it("moves NOT ONE BYTE where the side is dark or unstated, which is the ground the takes are frozen on", () => {
    for (const theme of ["classic", "dracula", "solarized", "mono"]) {
      const stated = renderThemed(SOURCE, { background: "dark" }, theme);
      expect(renderThemed(SOURCE, {}, theme)).toBe(stated);
    }
  });

  it("leaves the PLAIN drawing alone: a side is a palette, never a layout", () => {
    expect(render(SOURCE, { background: "light" })).toBe(render(SOURCE));
  });

  it("repaints on the light side, and every theme with it, none naming itself in the mirror", () => {
    for (const theme of ["classic", "dracula", "terra", "neon"]) {
      const dark = renderThemed(SOURCE, {}, theme);
      const light = renderThemed(SOURCE, { background: "light" }, theme);
      expect(light).not.toBe(dark);
      expect(stripSgr(light)).toBe(stripSgr(dark));
    }
  });
});

describe("the mirror of a colour", () => {
  it("flips a truecolour about its luminance and keeps its hue: a near-white becomes a near-black", () => {
    expect(styleCodesOf("#F0F0F0", "light")).toBe("38;2;15;15;15");
    expect(styleCodesOf("#0F0F0F", "light")).toBe("38;2;240;240;240");
  });

  it("leaves a MID grey where it is, which is what keeps the ruled lines their weight either way round", () => {
    const mirrored = Number(styleCodesOf("#808080", "light").split(";")[2]);
    expect(Math.abs(mirrored - 0x80)).toBeLessThanOrEqual(1);
  });

  it("opens near the page a THEME is carried onto: base's sand frame lands 22% off black, not the 17% it sat off white", () => {
    const drawn = renderThemed("flowchart TD\n  A[Start] --> B", { background: "dark" }, "base");
    expect(drawn).toContain("38;2;89;66;22");
    expect(drawn).not.toContain("38;2;68;52;17");
    expect(drawn).toContain("38;2;204;204;204");
  });

  it("spaces a fill off its stroke, fourteen points at least: base's fill sits under its frame, not four points from it", () => {
    const drawn = renderThemed("flowchart TD\n  subgraph S\n  A[Start] --> B\n  end", { look: "classic", background: "dark" }, "base");
    expect(drawn).toContain("48;2;40;27;0");
    expect(drawn).toContain("38;2;89;66;22");
    expect(drawn).not.toContain("48;2;90;61;0");
    expect(drawn).toContain("48;2;0;9;28");
    expect(drawn).toContain("38;2;20;40;79");
  });

  it("holds and spaces EVERY fill, each off its own stroke: base's participants, notes, activations and edge labels sit as dark as its nodes", () => {
    const sequence = renderThemed(
      "sequenceDiagram\n  Alice->>+Bob: hi\n  Bob->>+Bob: more\n  Note over Bob: think\n  Bob-->>-Alice: ok\n  Bob-->>-Alice: ok2",
      { background: "dark" },
      "base"
    );
    expect(sequence).toContain("48;2;40;27;0");
    expect(sequence).not.toContain("48;2;90;61;0");
    expect(sequence).toContain("38;2;89;66;22");
    expect(sequence).toContain("48;2;71;63;0");
    expect(sequence).not.toContain("48;2;109;96;0");
    expect(sequence).toContain("48;2;27;0;40");
    expect(sequence).not.toContain("48;2;61;0;90");
    const labelled = renderThemed("flowchart LR\n  A[un] -- oui --> B[deux]", { background: "dark" }, "base");
    expect(labelled).toContain("48;2;48;0;71");
    expect(labelled).not.toContain("48;2;61;0;90");
  });

  it("holds a mirrored fill within 14% of the page: forest's olive, a quarter off black when flipped, is a dark green", () => {
    const drawn = renderThemed("flowchart TD\n  subgraph S\n  A[Start] --> B\n  end", { look: "classic", background: "dark" }, "forest");
    expect(drawn).toContain("48;2;44;57;15");
    expect(drawn).toContain("38;2;178;243;171");
    expect(drawn).not.toContain("48;2;80;103;27");
    expect(drawn).toContain("48;2;25;71;0");
  });

  it("keeps the hue of a saturated colour, moving its lightness alone", () => {
    const codes = styleCodesOf("#99CCFF", "light").split(";");
    const [r, g, b] = codes.slice(2).map(Number);
    expect(b).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(r);
    expect(r).toBeLessThan(0x99);
  });

  it("mirrors the NAMED colours too near an end, onto the two names a palette cannot betray", () => {
    expect(styleCodesOf("white", "light")).toBe("30");
    expect(styleCodesOf("bright_white", "light")).toBe("30");
    expect(styleCodesOf("bright_black", "light")).toBe("30");
    expect(styleCodesOf("black", "light")).toBe("97");
    expect(styleCodesOf("bright_yellow", "light")).toBe("33");
    expect(styleCodesOf("red", "light")).toBe("31");
    expect(styleCodesOf("cyan", "light")).toBe("36");
  });

  it("mirrors a BACKGROUND colour by the same rule, a solid theme filling its regions with one", () => {
    expect(styleCodesOf("on white", "light")).toBe("40");
    expect(styleCodesOf("on #F0F0F0", "light")).toBe("48;2;15;15;15");
  });

  it("carries the attributes through untouched: a mirror is about colour and nothing else", () => {
    expect(styleCodesOf("bold italic white", "light")).toBe("1;3;30");
    expect(styleCodesOf("dim white", "light")).toBe("2;30");
    expect(styleCodesOf("bold italic", "light")).toBe(styleCodesOf("bold italic", "dark"));
  });
});

describe("the ground a drawing is painted for, known before a colour is chosen", () => {
  const codes = (text: string): string[] => [...new Set(text.match(/[34]8;2;\d+;\d+;\d+/gu) ?? [])];
  const DECLARED = "flowchart LR\n    A --> B\n    linkStyle 0 stroke:#000000\n";

  it("leaves a theme already on the asked side exactly as it declares itself, and lays no page under it", () => {
    const asIs = renderThemed("flowchart LR\n  A --> B", {}, "forest");
    expect(renderThemed("flowchart LR\n  A --> B", { background: "light" }, "forest")).toBe(asIs);
    expect(asIs).not.toContain("48;2;255;255;255");
    expect(asIs).toMatch(/^\u001b\[38;2;\d+;\d+;\d+m┌/u);
  });

  it("switches a theme to the twin mermaid ships on the other side, and back", () => {
    const source = "flowchart LR\n  A --> B";
    expect(renderThemed(source, { background: "dark" }, "redux")).toBe(renderThemed(source, {}, "redux-dark"));
    expect(renderThemed(source, { background: "light" }, "redux-dark")).toBe(renderThemed(source, {}, "redux"));
    expect(renderThemed(source, { background: "dark" }, "default")).toBe(renderThemed(source, {}, "dark"));
  });

  it("mirrors the inks of a theme drawn for the other side that has no twin, and still lays no page", () => {
    const source = "flowchart LR\n  A --> B";
    const dark = renderThemed(source, { background: "dark" }, "forest");
    expect(dark).not.toBe(renderThemed(source, {}, "forest"));
    expect(dark).not.toContain("48;2;0;0;0");
  });

  it("paints a declared black BLACK on either ground, as mermaid strokes what an author names, never flipped or lifted", () => {
    expect(codes(renderThemed(DECLARED, { background: "light" }, "mono"))).toContain("38;2;0;0;0");
    const onDark = codes(renderThemed(DECLARED, { background: "dark" }, "mono"));
    expect(onDark).toContain("38;2;0;0;0");
    expect(onDark).not.toContain("38;2;255;255;255");
  });

  it("paints a declared node stroke as declared on a light page, `#fbbf24` staying the yellow it was written as", () => {
    const source = "flowchart TB\n  D[Rollback]\n  F[Alert]\n  style D fill:#ef4444,stroke:#fbbf24\n  style F stroke:#f59e0b,stroke-width:4px";
    const drawn = codes(renderThemed(source, { background: "light" }, "default"));
    expect(drawn).toContain("38;2;251;191;36");
    expect(drawn).toContain("38;2;245;158;11");
    expect(drawn).not.toContain("38;2;192;139;3");
  });

  it("reads a #rrggbb as the ground itself: a tint is composited against that colour, not against black", () => {
    const gantt = "gantt\n  dateFormat YYYY-MM-DD\n  section S\n  T :a, 2024-01-01, 3d\n";
    const onBlack = codes(renderThemed(gantt, {}, "mono"));
    const onSlate = codes(renderThemed(gantt, { background: "#1e1e2e" }, "mono"));
    expect(onSlate).not.toEqual(onBlack);
    const band = must(onSlate.find((code) => code.startsWith("48;2;")));
    const [, , r, , b] = band.split(";").map(Number);
    expect(b).toBeGreaterThan(r);
  });

  it("spends the side once: a text painted for a ground ignores the side handed to the emitter", () => {
    const painted = renderThemedText(DECLARED, { background: "dark" }, "mono");
    expect(painted.toAnsi("light")).toBe(painted.toAnsi());
    expect(painted.isPainted).toBe(true);
    const unaware = renderThemedText(DECLARED, {}, "mono");
    expect(unaware.isPainted).toBe(false);
    expect(unaware.toAnsi("light")).not.toBe(unaware.toAnsi());
  });

  it("refuses a word that is neither side nor colour rather than guessing", () => {
    expect(() => renderThemed(DECLARED, { background: "blueish" }, "mono")).toThrow(/background/u);
  });
});
