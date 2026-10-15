import { describe, it, expect } from "vitest";
import { render } from "../../src/index.js";

describe("a quoted `>` in a block-beta label, text and never a shape delimiter", () => {
  it("draws the label whole, in the rectangle it was written as", () => {
    const drawn = render('block-beta\n    columns 2\n    A["a>b"] B["two"]\n', { width: 80 });
    expect(drawn).toContain("a>b");
    expect(drawn).not.toContain("\u27e9");
  });

  it("still reads an asymmetric block written outside quotes, which the guard must not cost", () => {
    expect(render("block-beta\n    columns 2\n    A>text] B[two]\n", { width: 80 })).toContain("\u27e9");
  });
});

describe("a block-beta label of several lines, sized line by line", () => {
  const four = 'block-beta\n    columns 2\n    A["un<br>deux<br>trois<br>quatre"] B["two"]\n';

  it("writes no line of the label into a border", () => {
    for (const line of render(four, { width: 40 }).split("\n")) {
      if (line.includes("┌") || line.includes("└")) expect(line).toMatch(/^[\s┌└┐┘─]*$/u);
    }
  });

  it("draws all four lines", () => {
    const drawn = render(four, { width: 40 });
    for (const half of ["un", "deux", "trois", "quatre"]) expect(drawn).toContain(half);
  });

  it("grows one row per line, the box of five lines standing one taller than the box of four", () => {
    const rows = (source: string): number => render(source, { width: 40 }).split("\n").length;
    const five = 'block-beta\n    columns 2\n    A["un<br>deux<br>trois<br>quatre<br>cinq"] B["two"]\n';
    expect(rows(five)).toBe(rows(four) + 1);
  });

  it("takes its width from the widest line and not from the raw string", () => {
    const widest = 'block-beta\n    columns 2\n    A["quatre"] B["two"]\n';
    const border = (source: string): string =>
      (render(source, { width: 40 }).split("\n").find((line) => line.includes("┌")) ?? "");
    expect(border(four)).toBe(border(widest));
  });

  it("leaves a one-line label at the five rows it has always had", () => {
    const one = 'block-beta\n    columns 2\n    A["un"] B["two"]\n';
    expect(render(one, { width: 40 }).split("\n").filter((line) => line.includes("│"))).toHaveLength(3);
  });

  const rowsOf = (lines: readonly string[]): number =>
    render(`block-beta\n    columns 2\n    A["${lines.join("<br>")}"] B["two"]\n`, { width: 40 })
      .split("\n")
      .filter((line) => line.includes("│")).length;

  it("holds a stacked label to the height one line gets, for as long as the frame has the room", () => {
    expect(rowsOf(["un"])).toBe(3);
    expect(rowsOf(["un", "deux"])).toBe(3);
    expect(rowsOf(["un", "deux", "trois"])).toBe(3);
  });

  it("grows one row per line past the frame, and never charges most for the label stacked least", () => {
    expect(rowsOf(["un", "deux", "trois", "quatre"])).toBe(4);
    expect(rowsOf(["un", "deux", "trois", "quatre", "cinq"])).toBe(5);
  });

  it("holds a flowchart node to the height a single line gets, whatever its label stacks", () => {
    const rows = render("flowchart TD\n    A[un<br>deux<br>trois] --> B[render]\n", { width: 40 }).split("\n");
    const tops = rows.map((line, at) => (line.includes("┌") ? at : -1)).filter((at) => at >= 0);
    const bottoms = rows.map((line, at) => (line.includes("└") ? at : -1)).filter((at) => at >= 0);
    expect(tops).toHaveLength(2);
    expect((bottoms[0]) - (tops[0])).toBe((bottoms[1]) - (tops[1]));
    const stacked = rows.slice(tops[0], (bottoms[0]) + 1);
    expect(stacked.filter((line) => line.includes("│") && line.replaceAll(/[\s│]/gu, "") === "")).toHaveLength(0);
  });
});

describe("a block-beta link label written BESIDE its run, never on it", () => {
  const source = 'block-beta\n    columns 3\n    A space B\n    C space:2\n    A --> B\n    A-- "goes to" -->C\n';

  it("leaves the run whole, the cell above the arrowhead carrying the line that feeds it", () => {
    const rows = render(source, { width: 80 }).split("\n");
    const head = rows.findIndex((row) => row.includes("⏷"));
    expect(head).toBeGreaterThan(0);
    expect(rows[head - 1].charAt(rows[head].indexOf("⏷"))).toBe("│");
  });

  it("writes the label whole, against the run it names", () => {
    expect(render(source, { width: 80 })).toContain("│goes to");
  });

  it("opens the gap a labelled HORIZONTAL run crosses, and writes the label above it", () => {
    const drawn = render('block-beta\n    columns 2\n    A B\n    A-- "goes to" -->B\n', { width: 80 });
    expect(drawn).toContain("goes to");
    expect(drawn).toMatch(/├─+⏵│/u);
  });
});

describe("a quoted delimiter in a block-beta label, the block kept", () => {
  const written = (label: string): string => `block-beta\n    columns 2\n    A["${label}"] B["two"]\n`;
  const DELIMITED = ["a > b", "x ] y", "p ( q", "r < s", "u } v"];

  it.each(DELIMITED)("keeps the block whose label holds `%s`", (label) => {
    const drawn = render(written(label), { width: 60 });
    expect(drawn).toContain(label);
    expect(drawn).toContain("two");
  });

  it("splits on the blanks OUTSIDE the quotes, which is what the tokenizer is for", () => {
    const drawn = render('block-beta\n    columns 2\n    A["a > b"] B["c ] d"]\n', { width: 60 });
    expect(drawn).toContain("a > b");
    expect(drawn).toContain("c ] d");
  });

  it("still opens an asymmetric block on an UNQUOTED `>`, the guard costing the syntax nothing", () => {
    expect(render("block-beta\n    columns 2\n    A>text] B[two]\n", { width: 60 })).toContain("\u27e9");
  });

  it("still reads a block arrow, whose own syntax is made of the characters now skipped inside quotes", () => {
    const drawn = render('block-beta\n    columns 3\n    A["depart"] B<["passe"]>(right) C["arrivee"]\n', { width: 60 });
    for (const label of ["depart", "passe", "arrivee"]) expect(drawn).toContain(label);
  });
});
