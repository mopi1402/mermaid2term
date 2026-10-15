import { describe, expect, it } from "vitest";
import { renderThemedText } from "../../src/index.js";

const WIDTHS = [60, 100] as const;

const draw = (width: number, ...body: string[]): string[] =>
  renderThemedText(["architecture-beta", ...body.map((line) => `    ${line}`)].join("\n"), { width }, "default").plain.split("\n");

const rowOf = (drawn: string[], text: string): number => drawn.findIndex((row) => row.includes(text));

describe("architecture statements mermaid 12 reads that used to drop a service, a group or an edge (2026-09-29)", () => {
  for (const width of WIDTHS) {
    describe(`at width ${width}`, () => {
      it("reads an id holding a hyphen, its edge with it", () => {
        const drawn = draw(width, "service my-api[My API]", "service db[DB]", "my-api:R --> L:db");
        expect(drawn[rowOf(drawn, "My API")]).toMatch(/My API.*[─━]⏵.*DB/u);
        expect(draw(width, "service a-1[One]", "service b-2[Two]").join("\n")).toMatch(/One.*Two/u);
      });

      it("draws an icon-only service and a bare one, linked", () => {
        const drawn = draw(width, "service a(server)", "service b", "a:R --> L:b");
        expect(drawn.join("\n").match(/┌/gu)).toHaveLength(2);
        expect(drawn[rowOf(drawn, "🖥")]).toMatch(/🖥.*[─━]⏵/u);
      });

      it("draws an icon text before the title", () => {
        const drawn = draw(width, 'service a "TXT"[Alpha]', "service b[B]", "a:R --> L:b");
        expect(drawn[rowOf(drawn, "TXT")]).toMatch(/TXT Alpha.*[─━]⏵.*B/u);
      });

      it("reads blanks between a service's parts", () => {
        const drawn = draw(width, "service a (server) [Alpha]", "service b [B]", "a:R --> L:b");
        expect(drawn[rowOf(drawn, "Alpha")]).toMatch(/🖥 Alpha.*[─━]⏵.*B/u);
      });

      it("frames a group with no title, with an icon alone, and an empty group", () => {
        const loose = draw(width, "service a[A]");
        expect(draw(width, "group g", "service a[A] in g").length).toBeGreaterThan(loose.length);
        expect(draw(width, "group g(cloud)", "service a[A] in g").join("\n")).toContain("☁");
        expect(draw(width, "group g[Empty]", "service a[A]").join("\n")).toContain("Empty");
        expect(draw(width, "group g[One]", "group h[Two]").join("\n")).toMatch(/One[\s\S]*Two|Two[\s\S]*One/u);
      });

      it("reads an edge with no blank around its shaft and one with blanks around its colons", () => {
        for (const edge of ["a:R-->L:b", "a : R --> L : b", "a:R--L:b"]) {
          const drawn = draw(width, "service a[A]", "service b[B]", edge);
          expect(drawn[rowOf(drawn, "A")], edge).toMatch(/A\s+[┝├][─━]+(⏵│|[┥┤])\s+B/u);
        }
      });

      it("reads a head written on either side of the shaft as a head on that end", () => {
        const into = draw(width, "service a[A]", "service b[B]", "a:R >-- L:b");
        expect(into[rowOf(into, "A")]).toMatch(/A\s+│⏴[─━]+[┥┤]\s+B/u);
        const out = draw(width, "service a[A]", "service b[B]", "a:R --< L:b");
        expect(out[rowOf(out, "A")]).toMatch(/A\s+[┝├][─━]+⏵│\s+B/u);
      });

      it("draws an edge's label, with or without a head", () => {
        const bare = draw(width, "service a[A]", "service b[B]", "a:R -[calls]- L:b").join("\n");
        expect(bare).toContain("calls");
        expect(bare).not.toContain("⏵");
        const headed = draw(width, "service a[A]", "service b[B]", 'a:R -["two words"]-> L:b').join("\n");
        expect(headed).toContain("two words");
        expect(headed).not.toContain('"');
        expect(headed).toContain("⏵");
      });
    });
  }
});

describe("a junction draws the heads its edges spell and keeps a branch with no opposite partner (2026-09-29)", () => {
  for (const width of WIDTHS) {
    describe(`at width ${width}`, () => {
      it("draws no head through a junction when no edge spells one, and the one written at the start", () => {
        const none = draw(width, "service a[A]", "service b[B]", "junction j", "a:R -- L:j", "j:R -- L:b").join("\n");
        expect(none).not.toMatch(/[⏴⏵]/u);
        const start = draw(width, "service a[A]", "service b[B]", "junction j", "a:R <-- L:j", "j:R -- L:b").join("\n");
        expect(start).toContain("⏴");
        expect(start).not.toContain("⏵");
      });

      it("links the service a junction's lone branch reaches, the runs meeting on a joint below which it hangs", () => {
        const drawn = draw(width, "service a[A]", "service b[B]", "service c[C]", "junction j", "a:R --> L:j", "j:R --> L:b", "j:B --> T:c");
        const top = rowOf(drawn, "A");
        expect(drawn[top]).toMatch(/A\s+[┝├][─━]+⏵[┳┬][─━]+⏵│\s+B/u);
        expect(rowOf(drawn, "C")).toBeGreaterThan(top);
        expect(drawn.join("\n")).toContain("⏷");
        expect(drawn.join("\n")).not.toMatch(/[┼╋]/u);
      });
    });
  }
});

describe("`align row` and `align column` seat their members as mermaid 12 does (2026-09-29)", () => {
  for (const width of WIDTHS) {
    it(`stacks an aligned column in its order and keeps a row in one, at width ${width}`, () => {
      const column = draw(width, "service a[A]", "service b[B]", "service c[C]", "align column c a b");
      const [c, a, b] = ["C", "A", "B"].map((name) => rowOf(column, `  ${name}  `));
      expect(c).toBeLessThan(a);
      expect(a).toBeLessThan(b);
      const row = draw(width, "service a[A]", "service b[B]", "service c[C]", "align row c a b");
      expect(row[rowOf(row, "  A  ")]).toMatch(/C\s.*A\s.*B/u);
    });
  }
});
