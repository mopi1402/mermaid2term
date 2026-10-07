import { describe, it, expect } from "vitest";
import { renderThemed } from "../../src/index.js";
import { must } from "../../src/must.js";
import { getTheme } from "../../src/paint/catalogue.js";
import { stripSgr } from "../support/ansi.js";
import { ESC } from "../../src/paint/escapes.js";

describe("a sequence participant drawn as mermaid's `.actor`: frame in `actorBorder`, box filled with `actorBkg`, lifeline in `actorLineColor`", () => {
  const SOURCE = "sequenceDiagram\n  participant A as Alice\n  participant B as Bob\n  A->>B: Hello\n  B-->>A: Hi";
  const rows = (drawn: string): string[] => drawn.split("\n");
  const PURPLE = "38;2;147;112;219";
  const FILL = "48;2;236;236;255";
  // mermaid's `default` writes every sequence name in `actorTextColor`, which it states as plain black, and fills
  // its `.labelBox` with `labelBoxBkgColor`, which is the participant's own `actorBkg`.
  const ACTOR_TEXT = "38;2;0;0;0";

  it("draws `default` on a light ground in mermaid's own inks: #9370DB frame and lifeline, #ECECFF inside the box", () => {
    const drawn = rows(renderThemed(SOURCE, { background: "light" }, "default"));
    expect(drawn[0]).toContain(`${PURPLE}m╭`);
    expect(drawn[0]).not.toContain("48;2;");
    expect(drawn[1]).toContain(`${FILL}m  `);
    expect(drawn[1]).toContain(`${ACTOR_TEXT};${FILL}mAlice`);
    const lifeline = must(drawn.find((row) => row.includes("Hello")));
    expect(lifeline).toContain(`${PURPLE}m┃`);
    expect(lifeline).not.toContain("[2;90m");
  });

  it("strokes the lifeline HEAVY on mermaid's eleven, as mermaid's own `line { stroke-width: 2px }` does, and plain on this package's", () => {
    const glyphs = (theme: string, options = {}): string =>
      stripSgr(renderThemed(SOURCE, { background: "light", ...options }, theme));
    for (const theme of ["base", "default", "dark", "forest", "neutral", "neo", "redux-dark-color"]) {
      expect(getTheme(theme).lifelineWidth).toBe(2);
      const drawn = glyphs(theme);
      expect(drawn).toContain("┃");
      expect(drawn.split("\n").find((row) => row.includes("Hello"))).toMatch(/^\s+┃ Hello\s+┃/u);
    }
    for (const theme of ["neon", "classic", "mono", "dracula"]) {
      expect(getTheme(theme).lifelineWidth).toBe(0.5);
      expect(glyphs(theme)).not.toContain("┃");
    }
    expect(getTheme("base", { actorLineColor: "#FF0000" }).lifelineWidth).toBe(2);
  });

  it("fills a database and a queue as a flowchart fills a drum: the inside on `actorBkg`, the back rim on the page, the lid on the fill", () => {
    const KINDS =
      'sequenceDiagram\n  participant Q@{ "type" : "queue" } as Jobs\n  participant D@{ "type" : "database" } as Orders\n  Q->>D: put';
    const drawn = rows(renderThemed(KINDS, { background: "light" }, "default"));
    const lid = must(drawn.find((row) => stripSgr(row).includes("⎛⁀⎞")));
    const inside = must(drawn.find((row) => stripSgr(row).includes("⎜ ⎟")));
    const names = must(drawn.find((row) => row.includes("Orders")));
    expect(lid).toContain(`${PURPLE}m⎛`);
    expect(lid).toContain(`${PURPLE};${FILL}m▔▔▔▔▔▔▔`);
    expect(drawn[0]).toContain(`${PURPLE}m▁▁▁▁`);
    expect(drawn[0]).not.toContain("48;2;");
    expect(lid).toContain(`${PURPLE};${FILL}m▁▁▁▁`);
    expect(inside).toContain(`${FILL}m       `);
    expect(inside).toContain(`${FILL}m    `);
    expect(inside).toContain(`${PURPLE}m⎜`);
    expect(names).toContain("[1;38;2;51;51;51mOrders");
    expect(names).not.toContain(FILL);
  });

  it("brackets a block in the LABEL BOX's own border washed onto the page, `.loopLine` taking that stroke and no frame colour of its own", () => {
    const LOOP = "sequenceDiagram\n  participant A\n  participant B\n  loop daily\n    A->>B: ping\n  end";
    const light = renderThemed(LOOP, { background: "light" }, "default");
    expect(light).toContain("38;2;185;162;232m┌");
    expect(light).toContain(`;${FILL}m loop | daily `);
    const dark = renderThemed(LOOP, { background: "dark" }, "default");
    expect(dark).toContain("38;2;133;133;133m┌");
    // forest states `labelBoxBorderColor: #326932`, a green of its own where its lifeline is `#13540c`.
    expect(renderThemed(LOOP, { background: "light" }, "forest")).toContain("38;2;153;180;153m┌");
    expect(getTheme("forest").frameOpacity).toBe(0.5);
    expect(getTheme("default").frameOpacity).toBe(0.65);
  });

  it("draws an activation in mermaid's own two colours: the band's glyphs in `activationBorderColor`, the `+n` chip on `activationBkgColor`", () => {
    const CALLS = "sequenceDiagram\n  A->>+B: one\n  A->>+B: two\n  B-->>-A: back\n  B-->>-A: back";
    const light = renderThemed(CALLS, { background: "light" }, "default");
    expect(light).toMatch(/38;2;102;102;102m[╖║╢╜]/u);
    expect(light).toContain("38;2;51;51;51;48;2;244;244;244m+1");
    const base = renderThemed(CALLS, { background: "light" }, "base");
    expect(base).toMatch(/38;2;227;170;255m[╖║╢╜]/u);
    expect(base).toContain("48;2;244;221;255m+1");
    const lifted = renderThemed(CALLS, { background: "dark" }, "redux-dark");
    expect(lifted).not.toMatch(/38;2;46;48;48m[╖║╢╜]/u);
    expect(lifted).toContain("48;2;71;73;73m+1");
    expect(getTheme("classic").variables.activationBkgColor).toBeUndefined();
    expect(renderThemed(CALLS, {}, "classic")).toMatch(/38;2;94;94;0m[╖║╢╜]/u);
  });

  it("colours each participant round `redux-color`'s ring, as mermaid does: stroke off `borderColorArray`, fill off `bkgColorArray`", () => {
    const FOUR = 'sequenceDiagram\n  participant A\n  participant B\n  participant C@{ "type" : "database" } as C\n  participant D\n  A->>B: x';
    const light = rows(renderThemed(FOUR, { background: "light" }, "redux-color"));
    const lidAt = light.findIndex((row) => row.includes("╭"));
    const [lid, inside] = [light[lidAt], light[lidAt + 1]];
    expect(lid).toContain("38;2;232;121;249m╭");
    expect(lid).toContain("38;2;45;212;191m╭");
    expect(lid).toContain("38;2;34;211;238m╭");
    expect(inside).toContain("48;2;253;244;255m");
    expect(inside).toContain("48;2;240;253;250m");
    const drum = must(light.find((row) => stripSgr(row).includes("⎜    ⎟")));
    expect(drum).toContain("38;2;251;146;60m⎜");
    expect(drum).toContain("48;2;255;247;237m");
    const dark = rows(renderThemed(FOUR, { background: "dark" }, "redux-dark-color"));
    const darkLid = dark.findIndex((row) => row.includes("╭"));
    expect(dark[darkLid]).toContain("38;2;232;121;249m╭");
    expect(dark[darkLid + 1]).toContain("48;2;17;17;19m");
    expect(getTheme("redux-dark-color").variables.bkgColorArray).toEqual([]);
    expect(getTheme("default").variables.borderColorArray).toBeUndefined();
    const plain = must(rows(renderThemed(FOUR, { background: "light" }, "default")).find((row) => row.includes("╭")));
    expect(plain.match(/38;2;147;112;219m╭/gu)).toHaveLength(3);
  });

  it("derives the three as mermaid does: `actorBorder` off the node's stroke, `actorBkg` off `mainBkg`, the lifeline off the frame", () => {
    const dark = getTheme("dark").variables;
    expect(dark.actorBorder).toBe("#CCCCCC");
    expect(dark.actorBkg).toBe("#1F2020");
    expect(dark.actorLineColor).toBe("#CCCCCC");
    expect(getTheme("forest").variables.actorBorder).toBe("#A6CF47");
    expect(getTheme("neutral").variables.actorBorder).toBe("#D4D4D4");
    expect(getTheme("neo").variables.actorBorder).toBe("#B3B3B3");
  });

  it("leaves the themes of this package as they were: the participant's frame in the node ink, no fill, a faint lifeline", () => {
    const drawn = rows(renderThemed(SOURCE, {}, "classic"));
    expect(drawn[0]).toContain("[36m╭");
    expect(drawn[1]).not.toContain("48;2;");
    expect(must(drawn.find((row) => row.includes("Hello")))).toContain("[2;90m│");
    const kinds = renderThemed('sequenceDiagram\n  participant D@{ "type" : "database" } as Orders\n  D->>D: x', {}, "classic");
    expect(kinds).not.toContain("48;2;");
    expect(kinds).toContain("[1;37mOrders");
    expect(getTheme("classic").variables.actorLineColor).toBeUndefined();
    expect(getTheme("mono").variables.actorLineColor).toBeUndefined();
  });
});

describe("the seven inks mermaid keeps for a sequence alone, each read off the variable its own stylesheet names", () => {
  const stated = (variables: Record<string, string>): string =>
    `---\nconfig:\n  theme: base\n  themeVariables:\n` +
    `${Object.entries(variables).map(([key, value]) => `    ${key}: "${value}"`).join("\n")}\n---\n` +
    "sequenceDiagram\n  participant A\n  participant B\n  alt daily\n    A->>B: ping\n  else twice\n    A->>B: pong\n  end\n";
  const painted = (variables: Record<string, string>): string[] =>
    renderThemed(stated(variables), { background: "light", width: 60 }, "base").split("\n");
  const inkOn = (rows: string[], glyph: RegExp): string => {
    for (const row of rows) {
      for (const run of row.split(ESC)) {
        const written = /^\[([0-9;:]*)m(.)/u.exec(run) ?? undefined;
        if (written !== undefined && glyph.test(written[2])) return written[1];
      }
    }
    throw new Error(`nothing painted on ${String(glyph)}`);
  };

  it("strokes the arrow and its head with `signalColor`, where a flowchart edge keeps `lineColor`", () => {
    const rows = painted({ signalColor: "#ff0000" });
    expect(inkOn(rows, /─/u)).toBe("38;2;255;0;0");
    expect(inkOn(rows, /⏵/u)).toBe("1;38;2;255;0;0");
  });

  it("writes a message with `signalTextColor` and a participant's name with `actorTextColor`", () => {
    const rows = painted({ signalTextColor: "#00ff00", actorTextColor: "#ff8800" });
    expect(inkOn(rows, /p/u)).toBe("3;38;2;0;255;0");
    // #ff8800 weighed against the fill it stands on, as every ink laid on a fill is here (`block-contrast`).
    expect(rows[1]).toContain("38;2;216;115;0;48;2;255;244;221mA");
  });

  it("fills the tab with `labelBoxBkgColor`, writes the block's own keyword in `labelTextColor` and a section's in `loopTextColor`", () => {
    const rows = painted({ labelBoxBkgColor: "#000080", labelTextColor: "#ffff00", loopTextColor: "#00ffff" });
    // The keyword is mermaid's `.labelText` inside the box, the condition beside it its `.loopText`: two inks.
    const opened = must(rows.find((row) => row.includes("alt |")));
    expect(opened).toContain("1;38;2;255;255;0;48;2;0;0;128m alt |");
    expect(opened).toContain("1;38;2;0;255;255;48;2;0;0;128m daily ");
    // mermaid writes no `else` of its own, only its condition; this page writes the keyword, and a keyword keeps
    // the label box's ink wherever it stands, the condition beside it keeping `.loopText`'s.
    const section = must(rows.find((row) => row.includes("else |")));
    expect(section).toContain("1;38;2;255;255;0;48;2;0;0;128m else |");
    expect(section).toContain("1;38;2;0;255;255;48;2;0;0;128m twice ");
  });

  it("brackets the block with `labelBoxBorderColor`, the stroke `.loopLine` takes, washed onto the page like every frame", () => {
    const rows = painted({ labelBoxBorderColor: "#ff00ff" });
    expect(inkOn(rows, /┌/u)).toBe("38;2;255;128;255");
    expect(inkOn(rows, /┊/u)).toBe("38;2;255;128;255");
  });
});
