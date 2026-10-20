import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";

const NAMES = ["constructor", "toString", "valueOf", "hasOwnProperty", "__proto__"];
const UNKNOWN = "nosuchicon";
const source = (name: string): string => `mindmap\n  root\n    A\n    ::icon(fa fa-${name})\n`;

// An icon name that is an Object.prototype member is an unknown icon, drawn without a glyph.
describe("mindmap icons looked up by own name only", () => {
  for (const name of NAMES) {
    it(`draws fa-${name} as an unknown icon`, () => {
      expect(render(source(name))).toBe(render(source(UNKNOWN)));
      expect(render(source(name), { charset: "compat" })).toBe(render(source(UNKNOWN), { charset: "compat" }));
    });
  }
});
