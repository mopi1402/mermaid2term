import { describe, expect, it } from "vitest";
import { declaredType } from "../../src/index.js";
import { corpus, DRAWN } from "../../scripts/corpus.js";

// A source of the corpus is pasted into mermaid as it is. mermaid's `role` is one word or a quoted string, so
// `: lent as` errors there, however kindly this renderer reads it: a label of several words has to be quoted.
const RELATION = /^\s*[^\s:]+(?::::\S+)?\s+\S*(?:--|\.\.)\S*\s+[^\s:]+(?::::\S+)?\s*:\s*(.+?)\s*$/u;
const ONE_ROLE = /^(?:"[^"]*"|\S+)$/u;

const SOURCES = corpus(DRAWN).filter(({ source }) => declaredType(source) === "erDiagram");

describe("the ER corpus writes only what mermaid reads", () => {
  it.each(SOURCES.map(({ id, source }) => [id, source]))("%s: every relationship label is one word or quoted", (_id, source) => {
    const loose = source
      .split("\n")
      .map((line) => RELATION.exec(line)?.[1])
      .filter((label): label is string => label !== undefined && !ONE_ROLE.test(label));
    expect(loose).toEqual([]);
  });
});
