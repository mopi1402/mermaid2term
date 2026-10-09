import { describe, it, expect } from "vitest";
import { render, renderThemed } from "../../src/index.js";
import { parseGantt } from "../../src/diagrams/gantt/parser.js";
import { hyperlinkOpen } from "../../src/paint/escapes.js";
import { TWO_PANES } from "../support/drawn.js";

const HEAD = "gantt\n    dateFormat YYYY-MM-DD\n";
const taskNames = (source: string): string[] =>
  parseGantt(source).sections.flatMap((section) => section.tasks.map((task) => task.title));

describe("a gantt `click` is a statement, its URL a hyperlink on the task's name", () => {
  const source =
    HEAD +
    "    Build :a1, 2024-01-01, 3d\n    Test :b1, after a1, 2d\n" +
    '    click a1 href "https://example.com"\n    click b1 call fn()\n    click b1 href "javascript:alert(1)"\n';

  it("draws no row for either click line", () => {
    expect(taskNames(source)).toEqual(["Build", "Test"]);
    expect(render(source, { width: 60 })).not.toContain("click");
  });

  it("links the name of the task the URL names, and a callback or a javascript: URL links nothing", () => {
    const painted = renderThemed(source, { width: 60 }, "default");
    expect(painted.split(hyperlinkOpen("https://example.com")).length - 1).toBe(1);
    const [build, test] = parseGantt(source).sections[0]?.tasks ?? [];
    expect(build?.link).toBe("https://example.com");
    expect(test?.link).toBeUndefined();
  });

  it("links every id of a comma list, and none named before its task is read", () => {
    const listed = HEAD + '    click a1 href "https://early.example"\n    A :a1, 2024-01-01, 1d\n    B :b1, 2024-01-02, 1d\n    click a1,b1 href "https://x.example"\n';
    expect(parseGantt(listed).sections[0]?.tasks.map((task) => task.link)).toEqual(["https://x.example", "https://x.example"]);
  });

  it("links the name in compact mode too", () => {
    const painted = renderThemed(`---\ndisplayMode: compact\n---\n${source}`, { width: 60 }, "default");
    expect(painted).toContain(hyperlinkOpen("https://example.com"));
  });
});

describe("the statements mermaid's gantt reads and draws nothing for", () => {
  it("hides `accTitle:`, `accDescr:` and a whole `accDescr { }` block", () => {
    const source = HEAD + "    accTitle: Plan\n    accDescr: The plan\n    accDescr {\n      line: one\n      two\n    }\n    A :a1, 2024-01-01, 3d\n";
    expect(taskNames(source)).toEqual(["A"]);
  });

  it("hides an `accDescr { }` closed on its own line", () => {
    expect(taskNames(HEAD + "    accDescr { one: line }\n    A :a1, 2024-01-01, 3d\n")).toEqual(["A"]);
  });

  it("drops `style` and `classDef` lines whose colour opens with `#`, which mermaid's lexer throws on", () => {
    const source = HEAD + "    A :a1, 2024-01-01, 3d\n    style a1 fill:#f00\n    classDef x fill:#0f0,stroke:#333\n";
    expect(taskNames(source)).toEqual(["A"]);
  });

  it("keeps `style a1 fill:red` a task, as mermaid's `taskTxt` and `taskData` read it", () => {
    expect(taskNames(HEAD + "    A :a1, 2024-01-01, 3d\n    style a1 fill:red\n")).toEqual(["A", "style a1 fill"]);
  });
});

describe("`todayMarker`: only the value `off` hides it, any other is its style", () => {
  it("keeps the marker on a style that merely holds the letters `off`", () => {
    expect(parseGantt(`${HEAD}    todayMarker stroke-dashoffset:2\n    A :a1, 2024-01-01, 3d\n`).todayMarker).toBe(true);
  });

  it("reads `off` alone, case kept as mermaid compares it", () => {
    expect(parseGantt(`${HEAD}    todayMarker off\n`).todayMarker).toBe(false);
    expect(parseGantt(`${HEAD}    todayMarker OFF\n`).todayMarker).toBe(true);
  });

  it("lets the last statement win", () => {
    expect(parseGantt(`${HEAD}    todayMarker off\n    todayMarker stroke:red\n`).todayMarker).toBe(true);
  });

  it("inks the marker with the style's stroke", () => {
    const day = (offset: number): string => {
      const at = new Date();
      at.setDate(at.getDate() + offset);
      return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;
    };
    const source = `${HEAD}    todayMarker stroke-width:5px,stroke:#00ff00\n    A :a1, ${day(-20)}, 5d\n    B :b1, ${day(15)}, 5d\n`;
    expect(parseGantt(source).todayInk).toBe("#00ff00");
    expect(renderThemed(source, { width: 60 }, "default")).toMatch(/38;2;0;255;0[;0-9]*m▎/u);
  });
});

describe("the statement keywords take any whitespace, as mermaid's `keyword\\s` rules do", () => {
  it("reads `title`, `section` and `dateFormat` followed by a tab", () => {
    const gantt = parseGantt("gantt\n    title\tPlan\n    dateFormat\tDD-MM-YYYY\n    section\tOne\n    A :a1, 05-01-2024, 3d\n");
    expect(gantt.title).toBe("Plan");
    expect(gantt.dateFormat).toBe("DD-MM-YYYY");
    expect(gantt.sections.map((section) => section.title)).toEqual(["One"]);
    expect(gantt.sections[0]?.tasks[0]?.start).toBeDefined();
  });

  it("reads a statement on the header line, `gantt title X`", () => {
    expect(parseGantt("gantt title Plan\n    A :a1, 2024-01-01, 3d\n").title).toBe("Plan");
    expect(render("gantt title Plan\n    A :a1, 2024-01-01, 3d\n", { width: 40 })).toContain("Plan");
  });
});

describe("a gantt statement mermaid 12 reads as it is written here", () => {
  it("reads a `dateFormat` parted from its format by a tab, mermaid's `dateFormat\\s` rule", () => {
    const source = "gantt\n    dateFormat\tDD-MM-YYYY\n    section S\n    A task :a1, 02-01-2014, 3d\n";
    expect(parseGantt(source).dateFormat).toBe("DD-MM-YYYY");
    for (const width of TWO_PANES) expect(render(source, { width }), `width ${width}`).toContain("2014-01-02");
  });

  it("writes a `<br>` in a task name as the letters it spells, as mermaid's task text does", () => {
    const source = HEAD + "    section S\n    A<br>B :a1, 2014-01-02, 3d\n";
    for (const width of TWO_PANES) expect(render(source, { width }), `width ${width}`).toContain("A<br>B");
  });
});
