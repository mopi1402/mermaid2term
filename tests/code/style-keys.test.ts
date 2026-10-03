import { describe, expect, it } from "vitest";
import { offenders, uncommented, type Guard } from "../support/sources.js";

const SPELLERS = new Set(["src/canvas/keys.ts", "src/source/css.ts", "tests/code/style-keys.test.ts"]);

const COMPOUND = [
  "edge_label", "bold_label", "plain_label", "italic_label", "node_faint", "subgraph_label",
  "active_mark", "frame_tab", "task_done", "task_active", "box_label",
  "@fill", "@label", "@chip", "@out", "@rim", "@wall", "@slab", "@notch", "@cluster", "@stripe", "@bg:", "@ink:",
  "class:", "nodestyle:", "linkstyle:", "section:", "sectionfg:", "sectionbg:",
];

const PROPERTIES = ["background-color", "stroke-dasharray", "stroke-width"];

const PLAIN = [
  "node", "edge", "arrow", "subgraph", "label", "default", "marker", "faint", "active", "frame", "actor",
  "lifeline", "note", "box", "stripe", "grid", "rule", "crit", "today", "excluded",
  "fill", "background", "stroke", "color",
];

const KEYWORD = /\/\/ keyword:/u;

const written = new RegExp(
  [...COMPOUND, ...PROPERTIES].map((key) => `"${key}"|'${key}'|\`[^\`]*${key}`).join("|"),
  "u"
);
const declared = new RegExp(
  `^\\s*(?:export )?(?:const|let|var) [A-Za-z_][\\w$]* = ["'](?:${PLAIN.join("|")})["'];`,
  "u"
);

describe("every style key and css property is written in one file and imported everywhere else", () => {
  for (const dir of ["src", "scripts"]) {
    it(`finds no second spelling of a style key or a css property in ${dir}`, () => {
      const guard: Guard = {
        reads: uncommented,
        spellers: SPELLERS,
        refuses: (line: string, raw: string) => !KEYWORD.test(raw) && (written.test(line) || declared.test(line)),
      };
      expect(offenders(dir, guard)).toEqual([]);
    });
  }
});
