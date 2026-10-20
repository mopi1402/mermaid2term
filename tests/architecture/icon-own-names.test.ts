import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";

const NAMES = ["constructor", "toString", "valueOf", "hasOwnProperty", "__proto__"];
const UNKNOWN = "nosuchicon";
const service = (name: string): string => `architecture-beta\n  service a(${name})[A]\n`;
const group = (name: string): string => `architecture-beta\n  group g(${name})[G]\n  service a(cloud)[A] in g\n`;

// An icon name that is an Object.prototype member is an unknown icon, drawn without a glyph.
describe("architecture icons looked up by own name only", () => {
  for (const name of NAMES) {
    it(`draws a service icon named ${name} as an unknown icon`, () => {
      expect(render(service(name))).toBe(render(service(UNKNOWN)));
    });
    it(`draws a group icon named ${name} as an unknown icon`, () => {
      expect(render(group(name))).toBe(render(group(UNKNOWN)));
    });
  }
});
