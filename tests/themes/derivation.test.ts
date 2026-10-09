import { describe, it, expect } from "vitest";
import { fromHsl, toHsl } from "../../src/colour/hsl.js";
import { adjust, darken, invert, lighten, mkBorder } from "../../src/colour/palette.js";
import { themeVariablesFrom } from "../../src/paint/themes.js";
import { renderThemed, renderThemedText } from "../../src/index.js";
import { formatHex, parseHex, type RGB } from "../../src/colour/rgb.js";
import { must } from "../../src/must.js";
import { DEFAULT_THEME, getTheme } from "../../src/paint/catalogue.js";
import { BARE } from "../../src/paint/theme-model.js";
import { themeAsked } from "../../src/paint/frontmatter.js";
import { withConfig } from "../support/frontmatter.js";

const hex = (written: string): RGB => must(parseHex(written));

const CRIT_GANTT = "gantt\n dateFormat YYYY-MM-DD\n section S\n  Now :crit, a, 2026-01-01, 5d\n";
const SECTIONS = "gantt\n dateFormat YYYY-MM-DD\n section One\n  A :a, 2026-01-01, 5d\n section Two\n  B :b, after a, 5d\n";

const hues = (drawn: string): string[] =>
  [...new Set(drawn.match(/[34]8;2;\d+;\d+;\d+/gu) ?? [])].filter((code) => {
    const [, , r, g, b] = code.split(";");
    return !(r === g && g === b);
  });

describe("the arithmetic a theme derives its colours with, which is khroma's, the one mermaid computes in", () => {
  it("ADDS to a channel rather than setting it, and clamps saturation and lightness inside their range", () => {
    const grey = hex("#808080");
    expect(toHsl(hex(formatHex(lighten(grey, 20)))).l).toBeCloseTo(toHsl(grey).l + 20, 0);
    expect(toHsl(hex(formatHex(darken(grey, 20)))).l).toBeCloseTo(toHsl(grey).l - 20, 0);
    expect(formatHex(lighten(hex("#FFFFFF"), 40))).toBe("#FFFFFF");
    expect(formatHex(darken(hex("#000000"), 40))).toBe("#000000");
  });

  it("WRAPS the hue where it clamps the other two, a rotation past the circle coming back round it", () => {
    const start = hex("#3399FF");
    expect(formatHex(adjust(start, { h: 360 }))).toBe(formatHex(start));
    expect(formatHex(adjust(start, { h: -120 }))).toBe(formatHex(adjust(start, { h: 240 })));
  });

  it("inverts a colour off 255 per channel, which is what mermaid reads a page's line colour off", () => {
    expect(formatHex(invert(hex("#000000")))).toBe("#FFFFFF");
    expect(formatHex(invert(hex("#F4F4F4")))).toBe("#0B0B0B");
  });

  it("makes a border mermaid's way: the fill washed of saturation and stepped toward or away from the light", () => {
    const fill = hex("#8a90dd");
    expect(formatHex(mkBorder(fill, true))).toBe(formatHex(adjust(fill, { s: -40, l: 10 })));
    expect(formatHex(mkBorder(fill, false))).toBe(formatHex(adjust(fill, { s: -40, l: -10 })));
  });

  it("comes back to where it started, so a derivation composed on itself does not drift", () => {
    for (const written of ["#8a90dd", "#33FF33", "#002B36", "#FABD2F"]) {
      expect(formatHex(fromHsl(toHsl(hex(written))))).toBe(written.toUpperCase());
    }
  });
});

describe("a theme built the way mermaid builds one: seeds, a derivation, and overrides that win twice", () => {
  it("spins the secondary and tertiary off the primary, at the turns mermaid turns them", () => {
    const seeded = getTheme("neon", { primaryColor: "#8a90dd" });
    const primary = hex("#8a90dd");
    expect(seeded.variables.secondaryColor).toBe(formatHex(adjust(primary, { h: -120 })));
    expect(seeded.variables.tertiaryColor).toBe(formatHex(adjust(primary, { h: 180, l: 5 })));
    expect(seeded.variables.activeTaskBkgColor).toBe(formatHex(lighten(primary, 23)));
    expect(seeded.variables.primaryBorderColor).toBe(formatHex(mkBorder(primary, true)));
  });

  it("REDRAWS what a seed is spun into, rather than laying the override on the answers already computed", () => {
    const base = getTheme("neon");
    const seeded = getTheme("neon", { primaryColor: "#8a90dd" });
    expect(seeded.variables.secondaryColor).not.toBe(base.variables.secondaryColor);
    expect(seeded.variables.activeTaskBkgColor).not.toBe(base.variables.activeTaskBkgColor);
  });

  it("never computes over a variable an author stated, whatever the derivation would have made of it", () => {
    const pinned = getTheme("neon", { primaryColor: "#8a90dd", secondaryColor: "#123456" });
    expect(pinned.variables.secondaryColor).toBe("#123456");
  });

  it("tells a variable LEFT OUT from one stated as no colour at all, which `??` cannot", () => {
    expect(getTheme("neon").variables.critBkgColor).not.toBeUndefined();
    expect(getTheme("neon", { critBkgColor: BARE }).variables.critBkgColor).toBeUndefined();
  });

  it("keeps the page it names declared for the side it tells, even though no region is ever filled with it", () => {
    expect(getTheme("forest").variables.background).not.toBeUndefined();
  });
});

describe("`mono`, the theme a drawing wears where nobody named one, which spends no colour at all", () => {
  it("is the default, so a drawing nobody dressed reads on a white terminal as well as on a black one", () => {
    expect(DEFAULT_THEME).toBe("mono");
  });

  it("names no colour in any of its roles: what it says, it says in WEIGHT", () => {
    const mono = getTheme("mono");
    const roles = [mono.node, mono.edge, mono.arrow, mono.subgraph, mono.label, mono.edgeLabel, mono.subgraphLabel];
    for (const role of roles) {
      for (const word of role.split(" ").filter((w) => w !== "")) {
        expect(["bold", "dim", "italic", "reverse", "underline"]).toContain(word);
      }
    }
  });

  it("says an alarm the only way a bare terminal can, by turning the cells over", () => {
    expect(renderThemed(CRIT_GANTT, { width: 60 })).toContain("1;7");
  });

  it("spends no HUE anywhere: what colour it writes at all is a grey, which is a shade and not a choice", () => {
    for (const drawn of [renderThemed(CRIT_GANTT, { width: 60 }), renderThemed(SECTIONS, { width: 60 })]) {
      expect(hues(drawn)).toEqual([]);
    }
  });

  it("writes a plain drawing exactly as an uncoloured one, the shape owing nothing to the theme", () => {
    const source = "flowchart TD\n  A[Start] --> B[End]\n";
    expect(renderThemedText(source, { width: 40 }).plain).toBe(renderThemedText(source, { width: 40 }, "neon").plain);
  });
});

describe("a source that dresses ITSELF, the way mermaid lets one: `config.theme` and `config.themeVariables`", () => {
  const GANTT = "gantt\n    dateFormat YYYY-MM-DD\n    section S\n        Now :crit, a, 2026-01-01, 5d\n";
  const framed = (config: string): string => withConfig(config, GANTT);

  it("takes the theme the source names over the one nobody asked for", () => {
    expect(hues(renderThemed(GANTT, { width: 60 }))).toEqual([]);
    expect(hues(renderThemed(framed("  theme: neon\n"), { width: 60 })).length).toBeGreaterThan(0);
  });

  it("leaves a theme the CALLER chose alone where the source names none of its own", () => {
    expect(renderThemed(GANTT, { width: 60 }, "neon")).toBe(renderThemed(framed("  theme: neon\n"), { width: 60 }));
  });

  it("reads a `themeVariables` block under mermaid's OWN names, so a mermaid block means the same thing here", () => {
    const drawn = renderThemed(framed('  theme: neon\n  themeVariables:\n    critBkgColor: "#00FF00"\n'), {
      width: 60,
    });
    expect(drawn).toContain("38;2;0;255;0");
  });

  it("folds mermaid's numbered section scale back into the one array a chart reads its bands off", () => {
    const read = themeVariablesFrom(new Map([["cScale2", "#123456"]]));
    expect((must(read.cScale))[2]).toBe("#123456");
  });

  // mermaid states each band under its own key, `cScale0` to `cScale11`, so a name left unwritten is not a name
  // set to nothing: it keeps the colour the chosen theme gives it, and only the written ones move.
  it("writes a stated band into the CHOSEN theme's scale, the bands nobody named left alone", () => {
    const theme = getTheme("redux-color");
    const read = themeVariablesFrom(new Map([["cScale2", "#123456"]]), theme.variables);
    expect((must(read.cScale))[2]).toBe("#123456");
    expect((must(read.cScale))[1]).toBe((must(theme.variables.cScale))[1]);
    expect((must(read.cScale))[3]).toBe((must(theme.variables.cScale))[3]);
  });

  it("keeps the other bands of a named theme when a frontmatter states one of them", () => {
    const stated = themeAsked(withConfig({ theme: "redux-color", themeVariables: { cScale0: '"#1098ad"' } }, "timeline\n"), DEFAULT_THEME);
    const plain = getTheme("redux-color");
    expect((must(stated.variables.cScale))[0]).toBe("#1098ad");
    expect((must(stated.variables.cScale)).slice(1)).toEqual((must(plain.variables.cScale)).slice(1));
  });

  it("drops a variable this cannot spend rather than guessing at it, and reads `null` as no colour", () => {
    const read = themeVariablesFrom(
      new Map([
        ["primaryColor", "#8a90dd"],
        ["dropShadow", "drop-shadow(1px 2px)"],
        ["critBkgColor", "null"],
      ])
    );
    expect(read.primaryColor).toBe("#8a90dd");
    expect(read.critBkgColor).toBe(BARE);
    expect("dropShadow" in read).toBe(false);
  });
});
