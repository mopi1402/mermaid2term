import { describe, expect, it } from "vitest";
import { parse } from "../../src/index.js";
import { computeLayout } from "../../src/graph/layout/passes.js";
import { HANG_COLUMNS, hangOf } from "../../src/graph/layout/boxes.js";
import { borrowable, overhangCandidates } from "../../src/graph/layout/overhang.js";
import { corpus, DRAWN } from "../../scripts/corpus.js";

const sources = corpus(DRAWN);

interface Judged {
  readonly weighed: number;
  readonly over: string[];
}

const judge = (source: string, padless: boolean): Judged => {
  const graph = parse(source);
  const layout = computeLayout(graph, { padless });
  const hang = hangOf(graph);
  const sizes = hang.sizes(layout);
  const over: string[] = [];
  let weighed = 0;
  for (const [id, sides] of overhangCandidates(graph, layout)) {
    const p = layout.placements.get(id);
    if (p === undefined || !p.overhangs) continue;
    const taken = (hang === HANG_COLUMNS ? p.drawWidth : p.drawHeight) - (sizes.get(hang.over(p)) ?? 0);
    if (taken <= 0) continue;
    weighed += 1;
    const room = borrowable(hang, layout, p, sides);
    if (taken > room) over.push(`${id}: takes ${taken}, reach holds ${room}`);
  }
  return { weighed, over };
};

describe("no box is ever drawn past the reach that was checked for it", () => {
  for (const { id: name, source } of sources) {
    for (const padless of [false, true]) {
      it(`${name}${padless ? " padless" : ""}: every overhang is within its borrowable reach`, () => {
        expect(judge(source, padless).over).toEqual([]);
      });
    }
  }

  it("weighs a real number of overhanging boxes, so the rule above is never judging nothing", () => {
    const weighed = sources.reduce(
      (all, { source }) => all + [false, true].reduce((both, padless) => both + judge(source, padless).weighed, 0),
      0
    );
    expect(weighed).toBeGreaterThan(20);
  });
});
