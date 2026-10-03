import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { CORPORA, THEME, WIDTHS, drawn, sourcePath, sources, takePath } from "../../scripts/ourtakes.js";

const read = (corpus: (typeof CORPORA)[number], name: string): string =>
  fs.readFileSync(sourcePath(corpus, name), "utf8");

describe.each([...CORPORA])("$name", (corpus) => {
  it("has a source to answer for, or the directory says nothing", () => {
    expect(sources(corpus).length).toBeGreaterThan(0);
  });

  it("is frozen on disk at every width and theme", () => {
    for (const name of sources(corpus)) {
      for (const width of WIDTHS) {
        for (const theme of [undefined, THEME]) expect(fs.existsSync(takePath(corpus, name, width, theme))).toBe(true);
      }
    }
  });
});

describe("the direction a flowchart names", () => {
  const HEADER = /^(?:flowchart|graph)[ \t]+(TB|TD|BT|LR|RL)\b/u;
  const named = (): Array<readonly [string, string]> => {
    const held: Array<readonly [string, string]> = [];
    for (const corpus of CORPORA) {
      for (const name of sources(corpus)) {
        const first = read(corpus, name).split("\n")[0];
        const found = HEADER.exec(first) ?? undefined;
        if (found !== undefined) held.push([name, found[1]]);
      }
    }
    return held;
  };

  it("is written in exactly five of them, named ones stay the exception", () => {
    const held = named();
    expect(held.map(([name]) => name).sort()).toEqual([
      // The labels showcase reads DOWN the page on purpose: seven nodes across it run past a narrow terminal,
      // and a label is what the drawing is about there.
      "labels",
      "left-to-right",
      "nested-directions",
      "right-to-left",
      "top-to-bottom",
    ]);
    expect(new Set(held.map(([, direction]) => direction))).toEqual(new Set(["LR", "RL", "TD"]));
  });

  it("is left OUT of every other flowchart, so the takes answer for the rotation", () => {
    let flowcharts = 0;
    for (const corpus of CORPORA) {
      for (const name of sources(corpus)) {
        const first = read(corpus, name).split("\n")[0];
        if (/^(?:flowchart|graph)\b/u.test(first)) flowcharts += 1;
      }
    }
    expect(flowcharts - named().length).toBeGreaterThan(35);
  });
});

for (const corpus of CORPORA) {
  describe.each(sources(corpus))(`${corpus.name}: %s, the drawing this package stands behind`, (name) => {
    it.each(WIDTHS)("has not moved at width %i", (width) => {
      expect(drawn(read(corpus, name), width, undefined)).toBe(fs.readFileSync(takePath(corpus, name, width, undefined), "utf8"));
    });

    it.each(WIDTHS)("has not moved at width %i, colours included", (width) => {
      expect(drawn(read(corpus, name), width, THEME)).toBe(
        fs.readFileSync(takePath(corpus, name, width, THEME), "utf8")
      );
    });
  });
}
