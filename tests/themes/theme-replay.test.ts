import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderThemedText } from "../../src/index.js";
import { getTheme } from "../../src/paint/catalogue.js";
import { themeVariablesFrom } from "../../src/paint/themes.js";
import { paintedGrid } from "../support/grid.js";

// Read off mermaid 12.0.0's own `getThemeVariables` in node, every theme file of its dist chunk run headless over each
// written set, every colour as khroma's `toHex` rounds it (an eighth pair is the colour's alpha).
interface Frozen {
  readonly written: Readonly<Record<string, string>>;
  readonly themes: Readonly<Record<string, Readonly<Record<string, string | readonly string[]>>>>;
}
const FROZEN: readonly Frozen[] = JSON.parse(readFileSync(new URL("./mermaid-12-theme-variables.json", import.meta.url), "utf8"));

// Decided divergences (`docs/divergences.md`): an rgba the terminal cannot blend is held as the theme file writes it
// (`dark`'s cluster rim) or its alpha dropped (`default`'s edge label ground).
const DIVERGENT: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ["dark", new Set(["clusterBorder"])],
  ["default", new Set(["edgeLabelBackground"])],
]);

const cases = FROZEN.flatMap(({ written, themes }) =>
  Object.entries(themes).map(([theme, theirs]) => [theme, JSON.stringify(written), written, theirs] as const)
);

describe("each mermaid theme replays its own `updateColors` over what the source writes, as mermaid 12 does", () => {
  it.each(cases)("derives %s under %s as its theme file does", (theme, _, written, theirs) => {
    const stated = Object.keys(written).length === 0 ? undefined : themeVariablesFrom(new Map(Object.entries(written)));
    const ours: Readonly<Record<string, unknown>> = { ...getTheme(theme, stated).variables };
    const drift = Object.entries(theirs)
      .filter(([name]) => !(DIVERGENT.get(theme)?.has(name) ?? false))
      .flatMap(([name, value]) => {
        const mine = ours[name];
        const same = typeof value === "string"
          ? typeof mine === "string" && mine.toUpperCase() === value.toUpperCase()
          : Array.isArray(mine) && value.every((seat, at) => String(mine[at]).toUpperCase() === seat.toUpperCase());
        return same ? [] : [`${name}: ${JSON.stringify(mine)} for ${JSON.stringify(value)}`];
      });
    expect(drift).toEqual([]);
  });

  it("keeps dark's cluster rim as the rgba its file writes, and default's edge label ground without its alpha", () => {
    expect(getTheme("dark").variables.clusterBorder).toBe("rgba(255,255,255,0.25)");
    expect(getTheme("default").variables.edgeLabelBackground).toBe("#E8E8E8");
  });

  it("leaves unset what a theme file never sets: neo's ER rows, dark's twelfth pie seat", () => {
    expect(getTheme("neo").variables.rowOdd).toBeUndefined();
    expect(getTheme("redux-dark").variables.rowEven).toBeUndefined();
    expect(getTheme("dark").variables.pie12).toBeUndefined();
  });

  it("re-derives a written primary colour's dependents per theme, and pins what the file pins", () => {
    const blue = themeVariablesFrom(new Map([["primaryColor", "#3366CC"]]));
    expect(getTheme("forest", blue).variables.pie1).toBe("#3366CC");
    expect(getTheme("forest", blue).variables.cScale[0]).not.toBe(getTheme("forest").variables.cScale[0]);
    // `theme-default.js` derives its bands in its constructor, before anything is written.
    expect(getTheme("default", blue).variables.cScale[0]).toBe(getTheme("default").variables.cScale[0]);
    expect(getTheme("dark", blue).variables.secondaryColor).toBe(getTheme("dark").variables.secondaryColor);
    expect(getTheme("base", blue).variables.secondaryColor).not.toBe(getTheme("base").variables.secondaryColor);
  });

  it("writes texts off `darkMode` where the file reads it", () => {
    const dark = themeVariablesFrom(new Map([["darkMode", "true"]]));
    expect(getTheme("base", dark).variables.primaryTextColor).toBe("#EEEEEE");
    expect(getTheme("base").variables.primaryTextColor).toBe("#333333");
  });
});

// mermaid's `[data-look="neo"].statediagram-cluster rect` fills a composite's name band `mainBkg`, over the
// `compositeTitleBackground` the classic look's `.statediagram-cluster rect` reads.
const COMPOSITE = (direction: string): string => `stateDiagram-v2\n  direction ${direction}\n  state Outer {\n    A --> B\n  }`;

function bandOf(theme: string, look: string, direction: string): string | undefined {
  const rows = paintedGrid(renderThemedText(`---\nconfig:\n  look: ${look}\n---\n${COMPOSITE(direction)}`, { width: 100, background: "dark" }, theme).toAnsi());
  const text = rows.map((row) => row.map(({ ch }) => ch).join(""));
  const at = text.findIndex((line) => line.includes("Outer"));
  return rows[at][text[at].indexOf("Outer")].ground;
}

describe.each(["TB", "LR"])("a composite state's name band under redux-dark, %s", (direction) => {
  it("stands on mainBkg under the neo look", () => {
    expect(bandOf("redux-dark", "neo", direction)).toBe("#111113");
  });

  it("stands on compositeTitleBackground under the classic look", () => {
    expect(bandOf("redux-dark", "classic", direction)).toBe("#16141f");
  });
});
