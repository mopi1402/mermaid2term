import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";

const headOf = (drawn: string): string[] =>
  drawn.split("\n").map((row) => row.trim()).filter((row) => row !== "").slice(0, 2);

const framed = (title: string, body: string): string => `---\ntitle: ${title}\n---\n${body}`;

describe("a frontmatter title, which every kind takes and a `title` statement overwrites", () => {
  const bodies: Array<[string, string]> = [
    ["flowchart", "flowchart LR\n    A[Start] --> B[Stop]\n"],
    ["sequence", "sequenceDiagram\n    A->>B: hi\n"],
    ["class", "classDiagram\n    A --> B\n"],
    ["state", "stateDiagram-v2\n    [*] --> Idle\n"],
    ["er", "erDiagram\n    CUSTOMER ||--o{ ORDER : places\n"],
    ["gantt", "gantt\n    dateFormat YYYY-MM-DD\n    section One\n    A task :a1, 2024-01-01, 3d\n"],
    ["pie", 'pie\n    "A" : 30\n    "B" : 70\n'],
    ["journey", "journey\n    section Go\n      Task: 5: Me\n"],
    ["gitgraph", "gitGraph\n    commit\n    commit\n"],
    ["mindmap", "mindmap\n  root((core))\n    one\n"],
    ["timeline", "timeline\n    2024 : shipped\n"],
    ["quadrant", "quadrantChart\n    x-axis Low --> High\n    y-axis Low --> High\n    A: [0.3, 0.6]\n"],
    ["xychart", "xychart-beta\n    x-axis [a, b, c]\n    bar [3, 5, 2]\n"],
    ["kanban", "kanban\n    Todo\n      one\n"],
    ["block", "block-beta\n    A B\n"],
    ["packet", "packet-beta\n    0-7: \"head\"\n    8-15: \"tail\"\n"],
    ["treemap", 'treemap-beta\n"Root"\n    "A": 10\n    "B": 20\n'],
    ["architecture", "architecture-beta\n    group api(cloud)[API]\n    service db(database)[DB] in api\n"],
    ["requirement", "requirementDiagram\n    requirement one {\n    id: 1\n    text: x\n    risk: low\n    verifymethod: test\n    }\n"],
  ];

  // A packet draws its title under its rows, the frontmatter one as its own.
  const UNDER = new Set(["packet"]);

  it.each(bodies.filter(([name]) => !UNDER.has(name)))("draws it over a %s, the body under it untouched", (_name, body) => {
    const bare = render(body, { width: 60 });
    const titled = render(framed("From the frontmatter", body), { width: 60 });
    expect(headOf(titled)[0]).toBe("From the frontmatter");
    expect(titled).toContain(bare.trim().split("\n")[0].trim());
  });

  it.each(bodies.filter(([name]) => UNDER.has(name)))("draws it under a %s, as its own title", (_name, body) => {
    const titled = render(framed("From the frontmatter", body), { width: 60 }).trimEnd().split("\n");
    expect(titled[titled.length - 1].trim()).toBe("From the frontmatter");
  });

  // mermaid sets the frontmatter title on the db BEFORE the parse (`Diagram.fromText`, 11.17.0), so a `title`
  // statement overwrites it: one title is drawn, never two stacked.
  const statements: Array<[string, string]> = [
    ["pie", 'pie title Statement title\n    "A" : 30\n    "B" : 70\n'],
    ["gantt", "gantt\n    title Statement title\n    dateFormat YYYY-MM-DD\n    section One\n    A task :a1, 2024-01-01, 3d\n"],
    ["sequence", "sequenceDiagram\n    title Statement title\n    A->>B: hi\n"],
    ["xychart", 'xychart-beta\n    title "Statement title"\n    x-axis [a, b]\n    bar [3, 5]\n'],
    ["journey", "journey\n    title Statement title\n    section Go\n      Task: 5: Me\n"],
    ["timeline", "timeline\n    title Statement title\n    2024 : shipped\n"],
    ["quadrant", "quadrantChart\n    title Statement title\n    x-axis Low --> High\n    y-axis Low --> High\n    A: [0.3, 0.6]\n"],
  ];

  it.each(statements)("lets a %s's own `title` statement win, and draws nothing of the frontmatter's", (_name, body) => {
    const drawn = render(framed("From the frontmatter", body), { width: 60 });
    expect(drawn).not.toContain("From the frontmatter");
    expect(drawn).toContain("Statement titl");
    // The row the frontmatter title used to spend is spent on nothing.
    expect(render(body, { width: 60 })).toBe(drawn);
  });

  it("keeps the frontmatter title where `title x` is no statement but an ordinary line", () => {
    const drawn = render(framed("From the frontmatter", "flowchart LR\n    title Statement line\n    A --> B\n"), {
      width: 60,
    });
    expect(headOf(drawn)[0]).toBe("From the frontmatter");
    expect(drawn).toContain("title Statement");
    expect(drawn).toContain("line");
  });
});
