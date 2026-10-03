import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";
import { withConfig } from "../support/frontmatter.js";

const LABEL = "Une étiquette assez longue pour passer à la ligne";

const drawn = (source: string): string => render(source, { width: 120 });
const holds = (source: string, text: string): boolean => drawn(source).split("\n").some((row) => row.includes(text));

const frontmatter = (section: string, px: number, body: string): string =>
  withConfig({ [section]: { wrappingWidth: px } }, body);

describe("`wrappingWidth`, the pixels mermaid wraps a node's text at, read in columns", () => {
  it.each(["LR", "TD"])("wraps at mermaid 12's own 120px when the key is not written (%s)", (dir) => {
    const body = `flowchart ${dir}\n  A[${LABEL}] --> B[court]`;
    expect(drawn(frontmatter("flowchart", 120, body))).toBe(drawn(body));
    expect(holds(body, "Une étiquette")).toBe(true);
    expect(holds(body, "Une étiquette assez")).toBe(false);
  });

  it.each(["LR", "TD"])("reads the pixels at mermaid's own rate, laying the lines mermaid.live 12.0.0 lays (%s)", (dir) => {
    const body = `flowchart ${dir}\n  A["Un libellé assez long fait de mots ordinaires pour voir où mermaid le coupe"] --> B[court]`;
    for (const line of ["Un libellé", "assez long", "fait de mots", "ordinaires", "pour voir où", "mermaid le"]) {
      expect(holds(frontmatter("flowchart", 100, body), line)).toBe(true);
    }
    for (const line of ["Un libellé assez", "long fait de", "mots ordinaires", "pour voir où"]) {
      expect(holds(frontmatter("flowchart", 120, body), line)).toBe(true);
    }
  });

  it.each(["LR", "TD"])("wraps a state at mermaid 12's own 120px too, `config.state.wrappingWidth` unwritten (%s)", (dir) => {
    const body = `stateDiagram-v2\n  direction ${dir}\n  s1 : ${LABEL}\n  [*] --> s1`;
    expect(drawn(frontmatter("state", 120, body))).toBe(drawn(body));
    expect(holds(body, "Une étiquette assez")).toBe(false);
  });

  it.each(["LR", "TD"])("never wraps narrower than the label's widest word, as mermaid packs the words up to it (%s)", (dir) => {
    const body = `flowchart ${dir}\n  A[Un libellé assez long fait de mots ordinaires] --> B[court]`;
    for (const px of [1, 5, 40]) {
      expect(holds(frontmatter("flowchart", px, body), "Un libellé")).toBe(true);
      expect(holds(frontmatter("flowchart", px, body), "assez long")).toBe(true);
    }
  });

  it.each(["LR", "TD"])("lays a wider line under `config.flowchart.wrappingWidth: 400` (%s)", (dir) => {
    const body = `flowchart ${dir}\n  A[${LABEL}] --> B[court]`;
    expect(holds(frontmatter("flowchart", 400, body), "Une étiquette assez longue pour passer à")).toBe(true);
  });

  it("reads the init directive the same way", () => {
    const source = `%%{init: {"flowchart": {"wrappingWidth": 100}}}%%\nflowchart LR\n  A[${LABEL}] --> B[court]`;
    expect(holds(source, "Une étiquette assez")).toBe(false);
    expect(holds(source, "étiquette")).toBe(true);
  });

  it("reads `config.state.wrappingWidth` on a state diagram, mermaid 12's own key there (#8211)", () => {
    const body = "stateDiagram-v2\n  s1 : Un état au libellé assez long pour se plier\n  [*] --> s1";
    expect(holds(frontmatter("state", 100, body), "Un état au libellé")).toBe(false);
    expect(drawn(frontmatter("flowchart", 100, body))).toBe(drawn(body));
  });
});

describe("the shapes mermaid 12 lays on one line whatever their length (#8227)", () => {
  it.each([
    ["a stadium", "([", "])"],
    ["a diamond", "{", "}"],
    ["a circle", "((", "))"],
    ["a double circle", "(((", ")))"],
  ])("keeps %s's label on one row, LR and TD", (_shape, open, close) => {
    for (const dir of ["LR", "TD"]) expect(holds(`flowchart ${dir}\n  A${open}${LABEL}${close} --> B[court]`, LABEL)).toBe(true);
  });

  it("still wraps a rectangle", () => {
    expect(holds(`flowchart LR\n  A[${LABEL}] --> B[court]`, LABEL)).toBe(false);
  });
});

describe("a node's label is never truncated, as in mermaid", () => {
  it.each(["LR", "TD"])("keeps every word of a long label, the key unwritten or at 120px (%s)", (dir) => {
    const body = `flowchart ${dir}\n  A[${LABEL}] --> B([${LABEL}])`;
    for (const source of [body, frontmatter("flowchart", 120, body)]) {
      const text = drawn(source);
      for (const word of LABEL.split(" ")) expect(text).toContain(word);
    }
  });
});
