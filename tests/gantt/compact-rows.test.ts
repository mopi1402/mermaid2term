import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { render, renderThemed } from "../../src/index.js";
import { THREE_PANES } from "../support/drawn.js";

const HEAD = "---\ndisplayMode: compact\n---\ngantt\n    dateFormat YYYY-MM-DD\n";
const BODY =
  "    section Frontend\n        Design      :done,   f1, 2026-02-02, 9d\n        Screens     :active, f2, after f1, 12d\n" +
  "        Polish      :        f3, after f2, 8d\n";
const MARKER = "        Beta        :vert,   v1, 2026-02-17, 0d\n";
const BORDERS = ["default", "padless", "borderless"] as const;

const rowWith = (drawn: string, word: string): string => drawn.split("\n").find((line) => line.includes(word)) ?? "";

describe("a compact gantt spends no row it can share, and loses no letter to a marker", () => {
  it.each(THREE_PANES)("writes the first bars on the section's own row, width %i", (width) => {
    for (const borders of BORDERS) {
      const drawn = render(HEAD + BODY, { width, borders });
      expect(rowWith(drawn, "Frontend"), drawn).toContain("▌");
      expect(drawn.split("\n").filter((line) => line.includes("▌")), drawn).toHaveLength(1);
    }
  });

  it("keeps a row of its own for each bar that overlaps another", () => {
    const drawn = render(`${HEAD}    section S\n        A :a, 2026-02-02, 9d\n        B :b, 2026-02-05, 9d\n`, { width: 80 });
    const rows = drawn.split("\n");
    const top = rows.findIndex((line) => line.startsWith(" S "));
    expect(rows[top]).toMatch(/ A /u);
    expect(rows[top + 1]).toMatch(/ B /u);
  });

  it("steps the name over the marker, the bar no longer for it", () => {
    const plain = render(HEAD + BODY, { width: 120 });
    const marked = render(HEAD + BODY + MARKER, { width: 120 });
    const row = rowWith(marked, "Frontend");
    expect(row).toMatch(/\p{L}┃\p{L}/u);
    expect(row.replace("┃", "")).toContain("Screens");
    expect([...rowWith(marked, "Frontend")].indexOf("▌")).toBe([...rowWith(plain, "Frontend")].indexOf("▌"));
  });

  it.each([30, 40, 80, 120])("never lets the marker stop at a letter, width %i", (width) => {
    for (const borders of BORDERS) {
      const rows = render(HEAD + BODY + MARKER, { width, borders }).split("\n").map((line) => [...line]);
      const foot = rows.findIndex((line) => line.includes("┴"));
      const col = rows[foot].indexOf("┴");
      const drawn = rows.map((line) => line.join("")).join("\n");
      expect(rows[foot - 1][col], drawn).toBe("┃");
      for (let r = 0; r < foot; r++) expect(rows[r][col] ?? " ", drawn).not.toMatch(/\p{L}/u);
    }
  });

  const NARROW =
    `${HEAD}    section Release\n        Code freeze :crit, r1, 2026-03-01, 4d\n` +
    "        Rollout to every region and every single customer :r2, after r1, 5d\n        Ship :milestone, m1, 2026-03-12, 0d\n" +
    "    section After\n        Retro :a1, 2026-03-01, 11d\n";

  it.each([40, 60])("writes a name its bar cannot hold over two rows, never three, width %i", (width) => {
    for (const borders of BORDERS) {
      const drawn = render(NARROW, { width, borders });
      const rows = drawn.split("\n");
      const top = rows.findIndex((line) => line.startsWith(" Release"));
      expect(rows[top], drawn).toContain("Rollout");
      expect(rows[top + 1], drawn).toMatch(/^ +│ .*\p{L}/u);
      expect(rows[top + 2], drawn).toMatch(/^ ╌/u);
      expect(rows[top + 1], drawn).toContain("▌");
    }
  });

  it.each([120, 160])("keeps a name in its bar over two rows rather than writing it whole beside, width %i", (width) => {
    const TRAIN = readFileSync("fixtures/gantt/compact.mmd", "utf8");
    for (const borders of BORDERS) {
      const drawn = render(TRAIN, { width, borders });
      const rows = drawn.split("\n");
      const top = rows.findIndex((line) => line.includes("Code"));
      expect(rows[top], drawn).not.toContain("freeze");
      expect(rows[top], drawn).toMatch(/Code +▌/u);
      expect(rows[top + 1], drawn).toMatch(/freeze *▌/u);
    }
  });

  it.each([30, 40, 60, 80, 149])("always writes a milestone's name under the dates, its line run from the mark to the name, width %i", (width) => {
    for (const [borders, source] of BORDERS.flatMap((b) => [[b, NARROW], [b, readFileSync("fixtures/gantt/compact.mmd", "utf8")]] as const)) {
      const drawn = render(source, { width, borders });
      const rows = drawn.split("\n").map((line) => [...line]);
      const mark = rows.findIndex((line) => line.includes("◆"));
      const col = rows[mark].indexOf("◆");
      const axis = rows.findIndex((line) => line.includes("└"));
      expect(rows[mark].join(""), drawn).not.toContain("Ship");
      const name = rows.findIndex((line, r) => r > axis && line.join("").includes("Ship"));
      expect(name, drawn).toBeGreaterThan(axis + 1);
      expect("┼┤├", drawn).toContain(rows[axis][col]);
      for (let r = mark + 1; r < name; r++) if (r !== axis) expect(rows[r][col], drawn).toBe("│");
      const at = rows[name].join("").indexOf("Ship");
      expect(col, drawn).toBeGreaterThanOrEqual(at);
      expect(col, drawn).toBeLessThan(at + 4);
    }
  });

  it.each(["default", "neon", "forest"])("inks a milestone's mark, line and name in one colour of their own, a marker's apart, theme %s", (theme) => {
    for (const background of ["dark", "light"] as const) {
      const source = HEAD + BODY + MARKER + "        Ship :milestone, m1, 2026-02-25, 0d\n";
      const lines = renderThemed(source, { width: 80, background }, theme).split("\n");
      const inkOf = (glyph: string): string | undefined => {
        const line = lines.find((l) => l.includes(glyph)) ?? "";
        const cell = line.split("\u001b[0m").find((c) => c.includes(glyph)) ?? "";
        return /\u001b\[([0-9;]*)m[^\u001b]*$/u.exec(cell)?.[1];
      };
      const foreground = (codes: string | undefined): string | undefined => /^[0-9;]*?38;2;\d+;\d+;\d+/u.exec(codes ?? "")?.[0];
      const ship = foreground(inkOf("Ship"));
      expect(ship).toBeDefined();
      expect(foreground(inkOf("◆"))).toBe(ship);
      expect(foreground(inkOf("┤") ?? inkOf("┼"))).toBe(ship);
      expect(inkOf("Beta")).not.toBe(inkOf("Ship"));
      expect(inkOf("Ship")?.split(";")).toContain("1");
    }
  });

  const TALK =
    `${HEAD}    section Proposal\n        Write abstract :done, abs, 2026-08-03, 5d\n        CFP closes :vert, cfp, 2026-08-10, 0d\n` +
    "    section Talk\n        Draft slides :active, slides, 2026-08-12, 10d\n        Schedule out :vert, sched, 2026-08-17, 0d\n" +
    "        Dry run :dry, after slides, 2d\n        Speaker check-in :vert, checkin, 2026-08-31, 0d\n" +
    "        Give the talk :milestone, talk, 2026-09-01, 0d\n";

  it.each(THREE_PANES)("seats a milestone's name whose line a marker's name would cross, width %i", (width) => {
    for (const borders of BORDERS) {
      const drawn = render(TALK, { width, borders });
      const rows = drawn.split("\n").map((line) => [...line]);
      const mark = rows.findIndex((line) => line.includes("◆"));
      const col = rows[mark].indexOf("◆");
      const name = rows.findIndex((line) => line.join("").includes("Give the talk"));
      expect(name, drawn).toBeGreaterThan(mark);
      for (let r = mark + 1; r < name; r++) expect("│┤┼├", drawn).toContain(rows[r][col]);
      for (const label of ["CFP closes", "Schedule out", "Speaker check-in"]) expect(drawn).toContain(label);
    }
  });
});
