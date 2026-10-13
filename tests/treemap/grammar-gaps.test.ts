import { describe, expect, it } from "vitest";
import { render, renderThemedText } from "../../src/index.js";

const lines = (source: string, width: number): string[] => render(source, { width }).split("\n").map((row) => row.trimEnd());
const drawn = (source: string, width: number): string => lines(source, width).join("\n");
// The words standing inside the boxes, each wall taken off.
const words = (source: string, width: number): string[] =>
  lines(source, width).flatMap((row) => row.split(/[│┊┌┐└┘┄─]+|\s{2,}/u).map((cell) => cell.trim()).filter((cell) => cell !== ""));

const MAP = '"A"\n  "a": 1\n  "b": 2';

// Every behaviour below measured on mermaid 12.0.0 headless, 2026-09-29.
describe.each([80, 120])("a treemap's grammar at width %i", (width) => {
  it("draws the `title` statement centred above the map, from any row, the last one winning", () => {
    const rows = lines(`treemap-beta\ntitle One\n${MAP}\n  title   My    map`, width);
    expect(rows[0].trim()).toBe("My map");
    expect(rows[1].trim()).toBe("");
    expect(drawn(`treemap-beta\ntitle One\n${MAP}\n  title   My    map`, width)).not.toContain("One");
    const map = Math.max(...rows.slice(2).map((row) => row.length));
    expect(Math.abs(rows[0].indexOf("My map") + 3 - map / 2)).toBeLessThanOrEqual(1);
  });

  it("reads a title on the header line and drops its trailing comment", () => {
    expect(lines(`treemap-beta title T\n${MAP}`, width)[0].trim()).toBe("T");
    expect(lines(`treemap-beta\ntitle T %% c\n${MAP}`, width)[0].trim()).toBe("T");
  });

  it("lets the `title` statement overwrite the frontmatter title", () => {
    const out = drawn(`---\ntitle: FM\n---\ntreemap-beta\ntitle Body\n${MAP}`, width);
    expect(out).toContain("Body");
    expect(out).not.toContain("FM");
  });

  it("takes a comma between the label and the value", () => {
    expect(words('treemap-beta\n"A"\n  "a", 1\n  "b" , 2', width)).toEqual(["A", "3", "b", "a", "2", "1"]);
  });

  it("reads single-quoted labels", () => {
    expect(words("treemap-beta\n'A'\n  'a': 1\n  \"b\": 2", width)).toEqual(["A", "3", "b", "a", "2", "1"]);
  });

  it("keeps an empty label, its children staying under it", () => {
    const out = words('treemap-beta\n""\n  "": 5\n  "x": 2', width);
    expect(out).toEqual(["7", "x", "5", "2"]);
    expect(lines('treemap-beta\n""\n  "": 5\n  "x": 2', width).filter((row) => row.includes("┊")).length).toBeGreaterThan(0);
  });

  it("strips a thousands separator and reads a leading dot", () => {
    expect(words('treemap-beta\n"A"\n  "a": 1,000\n  "b": 1,5', width)).toEqual(["A", "1,015", "a", "b", "1,000", "15"]);
    expect(words('treemap-beta\n"A"\n  "a": .5\n  "b": 1', width)).toEqual(["A", "1.5", "b", "a", "1", "0.5"]);
  });
});

describe.each([80, 120])("a treemap's `classDef` at width %i", (width) => {
  const styleOf = (source: string, word: string, nth = 0): string => {
    const rows = renderThemedText(source, { width, background: "light" }, "default").rows;
    let seen = 0;
    for (const row of rows) {
      const text = row.map((cell) => cell.ch).join("");
      for (let at = text.indexOf(word); at !== -1; at = text.indexOf(word, at + 1)) {
        if (seen++ === nth) return row[at].style;
      }
    }
    return "";
  };
  const CLASS = "classDef hot fill:#ff0000,stroke:#00ff00,color:#0000ff;";

  it("grounds a classed section in its fill, inks its name in its colour and its frame in its stroke", () => {
    const plain = `treemap-beta\n"A"\n  "a": 1\n  "b": 2`;
    const classed = `treemap-beta\n"A":::hot\n  "a": 1\n  "b": 2\n${CLASS}`;
    expect(styleOf(classed, "A")).toBe("bold #0000FF on #FF6666");
    expect(styleOf(classed, "┌")).not.toBe(styleOf(plain, "┌"));
    expect(styleOf(classed, "b")).not.toBe(styleOf(plain, "b"));
  });

  it("grounds a classed leaf in its fill, strokes its box and inks its name and value", () => {
    const plain = `treemap-beta\n"A"\n  "a": 1\n  "b": 2`;
    const classed = `treemap-beta\n${CLASS}\n"A"\n  "a": 1:::hot\n  "b": 2`;
    expect(styleOf(classed, "a")).toMatch(/^bold #0000FF on /u);
    expect(styleOf(classed, "1")).toMatch(/^italic #0000FF on /u);
    expect(styleOf(classed, "a")).not.toBe(styleOf(plain, "a"));
    expect(styleOf(classed, "b")).toBe(styleOf(plain, "b"));
    expect(styleOf(classed, "┌", 2)).not.toBe(styleOf(plain, "┌", 2));
  });
});
