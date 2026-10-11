import { describe, expect, it } from "vitest";

import { render, renderThemedText } from "../../src/index.js";
import { CSI } from "../../src/paint/escapes.js";

const TITLE = "Quarterly revenue from the northern regional offices";
const framed = (title: string, body: string): string => `---\ntitle: ${title}\n---\n${body}`;

const bodies: Array<[string, string]> = [
  ["flowchart TD", "flowchart TD\n    A[Start] --> B[Stop]\n"],
  ["flowchart LR", "flowchart LR\n    A[Start] --> B[Stop]\n"],
  ["sequence", "sequenceDiagram\n    A->>B: hi\n"],
  ["class", "classDiagram\n    A --> B\n"],
  ["pie", 'pie\n    "A" : 30\n    "B" : 70\n'],
  ["gantt", "gantt\n    dateFormat YYYY-MM-DD\n    section One\n    A task :a1, 2024-01-01, 3d\n"],
];

const headRows = (drawn: string): string[] => {
  const rows = drawn.split("\n");
  return rows.slice(0, rows.findIndex((row) => row.trim() === ""));
};

describe("a frontmatter title wider than the width budget", () => {
  describe.each([30, 40])("at width %i", (width) => {
    it.each(bodies)("folds on words over a %s, no word dropped", (_name, body) => {
      const drawn = render(framed(TITLE, body), { width });
      const head = headRows(drawn);
      const room = Math.max(width, ...drawn.split("\n").slice(head.length).map((row) => row.length));
      expect(head.length).toBeGreaterThan(1);
      expect(head.map((row) => row.trim()).join(" ")).toBe(TITLE);
      for (const row of head) expect(row.length).toBeLessThanOrEqual(room);
    });

    it.each(bodies)("folds the same way when painted over a %s", (_name, body) => {
      const painted = renderThemedText(framed(TITLE, body), { width }, "dark");
      const head = headRows(painted.plain);
      expect(head.map((row) => row.trim()).join(" ")).toBe(TITLE);
      const inked = painted.toAnsi().split("\n").slice(0, head.length);
      for (const row of inked) expect(row.trimStart().startsWith(CSI)).toBe(true);
    });
  });

  it("cuts only a lone word longer than the budget", () => {
    const head = headRows(render(framed("Short Supercalifragilisticexpialidocious_and_more", bodies[0][1]), { width: 30 }));
    expect(head.map((row) => row.trim())).toEqual(["Short", "Supercalifragilisticexpialido…"]);
  });

  it.each(bodies)("stays on one line over a %s while the budget holds it, wider than the drawing", (_name, body) => {
    const head = headRows(render(framed(TITLE, body), { width: 120 }));
    expect(head.map((row) => row.trim())).toEqual([TITLE]);
  });
});
