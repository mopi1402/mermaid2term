import { describe, expect, it } from "vitest";

import { render, renderThemed } from "../../src/index.js";
import { UNICODE } from "../../src/canvas/charsets.js";
import { parseTimeline } from "../../src/diagrams/timeline/parser.js";
import { renderTimeline, renderTimelineHorizontal, renderTimelineVertical } from "../../src/diagrams/timeline/render.js";
import { NEWLINE } from "../../src/text/chars.js";
import { TWO_PANES } from "../support/drawn.js";
import { withConfig } from "../support/frontmatter.js";

const events = (source: string): string[][] =>
  parseTimeline(source).sections.flatMap((section) => section.events.map((event) => [event.title, ...event.details]));

const across = (source: string, budget?: number): string[] =>
  renderTimelineHorizontal(parseTimeline(source), UNICODE, budget).toString().split(NEWLINE);
const down = (source: string, budget?: number): string[] =>
  renderTimelineVertical(parseTimeline(source), UNICODE, budget).toString().split(NEWLINE);

describe("timeline statements read as mermaid's lexer cuts them", () => {
  it("makes one event per `: ` on a line, as the event token stops at the next one", () => {
    expect(events("timeline\n  2004 : Facebook : Google")).toEqual([["2004", "Facebook", "Google"]]);
    expect(events("timeline\n  2004 : a:b : c")).toEqual([["2004", "a:b", "c"]]);
    expect(events("timeline\n  2004: Facebook")).toEqual([["2004", "Facebook"]]);
    expect(across("timeline LR\n  2004 : Facebook : Google").some((row) => /│\s+Google\s+│/u.test(row))).toBe(true);
    expect(down("timeline TD\n  2004 : Facebook : Google")).toContain(" │   Google");
  });

  it("joins a line opening on `: ` to the last period written, a section between them or not", () => {
    expect(events("timeline\n  2004 : Facebook\n       : Google\n  2005")).toEqual([["2004", "Facebook", "Google"], ["2005"]]);
    expect(events("timeline\n  2004 : A\n  section Later\n  : B")).toEqual([["2004", "A", "B"]]);
    expect(render("timeline LR\n  2004 : Facebook\n       : Google")).not.toContain(": Google");
  });

  it("keeps a `%%` inside a period or an event as text, mermaid's comment rules firing only where a token starts", () => {
    expect(events("timeline\n  2025 : Seoul %% pending permit")).toEqual([["2025", "Seoul %% pending permit"]]);
    expect(events("timeline\n  2002 : 50%% done")).toEqual([["2002", "50%% done"]]);
    expect(events("timeline\n  %% a comment\n  2002 %% kept")).toEqual([["2002 %% kept"]]);
    expect(events("timeline\n  2003 :%% gone")).toEqual([["2003"]]);
    expect(events("timeline\n%%{init: {\"theme\": \"dark\"}}%%\n  2002")).toEqual([["2002"]]);
  });

  it("drops a `#` line and cuts a period at its `#`, the rest of the line with it", () => {
    expect(events("timeline\n  # a note\n  2002 # aside : lost\n  2003 : C# language")).toEqual([
      ["2002"],
      ["2003", "C# language"],
    ]);
  });

  it("takes any whitespace after `title`, mermaid's `title\\s`", () => {
    expect(parseTimeline("timeline\n  title\tTabbed\n  2002").title).toBe("Tabbed");
  });

  it("still draws a line mermaid throws on, cut on its first ` : `", () => {
    expect(events("timeline\n  : Orphan\n  10:30 : Meeting\n  2002 :")).toEqual([[": Orphan"], ["10:30", "Meeting"], ["2002 :"]]);
  });
});

describe("timeline text breaks and folds as mermaid's node `wrap` does", () => {
  const broken = "timeline\n  section Q1 <br> Release\n    2024 <br> spring : Paris<br>Lyon\n";

  it("breaks on `<br>` in a period, an event and a section, across and down", () => {
    const rows = across(broken);
    for (const word of ["Q1", "Release", "2024", "spring", "Paris", "Lyon"]) {
      expect(rows.some((row) => new RegExp(`│\\s+${word}\\s+│`, "u").test(row)), word).toBe(true);
    }
    expect(rows.join(NEWLINE)).not.toContain("<br>");
    expect(down(broken)).toEqual([" ══ Q1 ══", "    Release", " │", " ●── 2024", " │   spring", " │", " │   Paris", " │   Lyon"]);
  });

  it("leaves `<br/>` and `<br />` as text, mermaid's split naming `<br>` alone", () => {
    expect(render("timeline LR\n  2024 : a<br/>b")).toContain("a<br/>b");
  });

  it("folds a long event inside mermaid's node width, 150px across and 300px down, words kept whole", () => {
    const source = "timeline LR\n  2023 : a very long event name that mermaid would wrap inside its node\n";
    const rows = across(source);
    expect(rows.some((row) => /│\s+a very long event\s+│/u.test(row))).toBe(true);
    expect(Math.max(...rows.map((row) => row.length))).toBeLessThan(30);
    const lines = down(source.replace("LR", "TD"));
    expect(lines).toContain(" │   a very long event name that mermaid");
    expect(lines).toContain(" │   would wrap inside its node");
    expect(down(source.replace("LR", "TD"), 30)).toContain(" │   a very long event name");
  });

  it("sets a blank row between two events once one of them takes several lines", () => {
    const rows = across("timeline LR\n  2023 : Lyon : a very long event name that mermaid wraps\n");
    const lyon = rows.findIndex((row) => row.includes("Lyon"));
    expect(rows[lyon + 1]).toMatch(/^│\s+│$/u);
    expect(rows[lyon + 2]).toContain("a very long event");
    expect(down("timeline TD\n  2023 : Lyon : a very long event name that mermaid wraps\n")).toEqual([
      " ●── 2023",
      " │   Lyon",
      " │",
      " │   a very long event name that mermaid",
      " │   wraps",
    ]);
  });

  it("folds a written `LR` narrower until the budget holds it, rather than overflowing", () => {
    const source = "timeline LR\n  2023 : Lyon opens its first café in the old town\n  2024 : Paris doubles the seating\n";
    const tight = renderTimeline(parseTimeline(source), UNICODE, 40);
    expect(tight.width).toBeLessThanOrEqual(40);
    expect(tight.toString()).toContain("⏵");
    expect(renderTimeline(parseTimeline(source), UNICODE, 40, true, false).width).toBeGreaterThan(40);
  });
});

describe("timeline colours stepped per period where no section is written", () => {
  const bare = "timeline\n  2023 : A\n  2024 : B\n  2025 : C\n";
  const periodStyles = (canvas: ReturnType<typeof renderTimelineHorizontal>, names: string[]): string[] => {
    const rows = canvas.toString().split(NEWLINE);
    return names.map((name) => {
      const row = rows.findIndex((line) => line.includes(name));
      return canvas.getStyle(row, rows[row].indexOf(name));
    });
  };

  it("gives each period its own colour index, across and down", () => {
    const tl = parseTimeline(bare);
    expect(periodStyles(renderTimelineHorizontal(tl), ["2023", "2024", "2025"])).toEqual(["sectionfg:0", "sectionfg:1", "sectionfg:2"]);
    expect(periodStyles(renderTimelineVertical(tl), ["2023", "2024", "2025"])).toEqual(["sectionfg:0", "sectionfg:1", "sectionfg:2"]);
  });

  it("holds every period on the first colour under `disableMulticolor`, frontmatter or init directive", () => {
    const tl = parseTimeline(bare, { disableMulticolor: "true" });
    expect(tl.multicolor).toBe(false);
    expect(periodStyles(renderTimelineHorizontal(tl), ["2023", "2024", "2025"])).toEqual(["sectionfg:0", "sectionfg:0", "sectionfg:0"]);

    const periodInk = (painted: string, name: string): string => {
      const row = painted.split(NEWLINE).find((line) => line.includes(name)) ?? "";
      return row.slice(0, row.indexOf(name)).split("│").slice(-1)[0] ?? "";
    };
    const ink = (source: string): string[] => {
      const painted = renderThemed(source, { width: 80, background: "light" }, "default");
      return ["2023", "2024"].map((name) => periodInk(painted, name).trim());
    };
    const [first, second] = ink(bare);
    expect(first).not.toBe(second);
    const held = ink(withConfig({ timeline: { disableMulticolor: true } }, bare));
    expect(held[0]).toBe(held[1]);
    const directed = ink(`%%{init: {"timeline": {"disableMulticolor": true}}}%%\n${bare}`);
    expect(directed[0]).toBe(directed[1]);
  });

  it("keeps the section's colour on its periods where sections are written, as mermaid does", () => {
    const tl = parseTimeline("timeline\n  section One\n    2023 : A\n    2024 : B\n  section Two\n    2025 : C\n");
    expect(periodStyles(renderTimelineHorizontal(tl), ["2023", "2024", "2025"])).toEqual(["sectionfg:0", "sectionfg:0", "sectionfg:1"]);
  });
});

describe("a statement written on the timeline's header line", () => {
  for (const direction of ["LR", "TD"] as const) {
    it(`reads it as mermaid's lexer does, the first period after the keyword, ${direction}`, () => {
      const source = `timeline ${direction} 2002 : X\n    2004 : Y\n`;
      const parsed = parseTimeline(source);
      expect(parsed.direction).toBe(direction);
      expect(parsed.sections.flatMap((section) => section.events.map((event) => [event.title, event.details]))).toEqual([
        ["2002", ["X"]],
        ["2004", ["Y"]],
      ]);
      for (const width of TWO_PANES) expect(render(source, { width }), `width ${width}`).toContain("2002");
    });
  }

  it("reads a bare word or a title there too, with no direction written", () => {
    expect(parseTimeline("timeline XX\n    2004 : Y\n").sections[0].events.map((event) => event.title)).toEqual(["XX", "2004"]);
    expect(parseTimeline("timeline title Hist\n    2004 : Y\n").title).toBe("Hist");
    expect(parseTimeline("timeline\n    2004 : Y\n").sections[0].events).toHaveLength(1);
  });
});
