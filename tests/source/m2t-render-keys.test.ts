import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";
import type { RenderOptions } from "../../src/options.js";
import { withConfig } from "../support/frontmatter.js";

type Asked = Partial<RenderOptions> & { width?: number };

const CHAIN = "    A --> B --> C --> D --> E --> F\n";
const FRAMED = "    subgraph G [Group]\n        A --> B\n    end\n    G --> C\n";
const WIDE = "    A[Start here] --> B[Middle step] --> C[Next one] --> D[Last stop]\n    subgraph G [Group]\n        C\n    end\n";
const LABELLED = "    A -->|a rather long label| B\n    A --> C\n";
const PADLESS: Asked = { borders: "padless" };

interface Case {
  readonly name: string;
  readonly said: string;
  readonly unsaid: string;
  readonly meant: Asked;
  readonly unmeant: Asked;
  readonly body: string;
  readonly caller: Asked;
  readonly headers: readonly string[];
}

// `bands` folds a horizontal chain alone, `autoRotate` turns a flowchart whose direction the source left unsaid.
const CASES: readonly Case[] = [
  { name: "borders", said: "padless", unsaid: "default", meant: { borders: "padless" }, unmeant: { borders: "default" }, body: CHAIN, caller: {}, headers: ["flowchart TD", "flowchart LR"] },
  { name: "bands", said: "2", unsaid: "1", meant: { bands: 2 }, unmeant: { bands: 1 }, body: CHAIN, caller: {}, headers: ["flowchart LR"] },
  { name: "airyLabels", said: "false", unsaid: "true", meant: { airyLabels: false }, unmeant: { airyLabels: true }, body: LABELLED, caller: PADLESS, headers: ["flowchart TD", "flowchart LR"] },
  { name: "snugFrames", said: "true", unsaid: "false", meant: { snugFrames: true }, unmeant: { snugFrames: false }, body: FRAMED, caller: PADLESS, headers: ["flowchart TD", "flowchart LR"] },
  { name: "autoRotate", said: "false", unsaid: "true", meant: { autoRotate: false }, unmeant: { autoRotate: true }, body: WIDE, caller: { width: 30 }, headers: ["flowchart"] },
];

const globally = (key: string, value: string, text: string): string => withConfig({ [key]: value }, text);
const perKind = (key: string, value: string, text: string, global?: string): string =>
  withConfig(`${global === undefined ? "" : `  ${key}: ${global}\n`}  flowchart:\n    ${key}: ${value}\n`, text);

describe("our own render settings read from the source as `m2t_` keys", () => {
  for (const c of CASES) {
    const key = `m2t_${c.name}`;
    for (const header of c.headers) {
      const text = `${header}\n${c.body}`;
      const drawn = (source: string, extra: Asked = {}): string => render(source, { ...c.caller, ...extra });

      it(`${key} (${header}): the global key draws what the option draws, and changes the drawing`, () => {
        expect(drawn(text, c.meant)).not.toBe(drawn(text));
        expect(drawn(globally(key, c.said, text))).toBe(drawn(text, c.meant));
      });

      it(`${key} (${header}): the kind's own key is read, and wins over the global one`, () => {
        expect(drawn(perKind(key, c.said, text))).toBe(drawn(text, c.meant));
        expect(drawn(perKind(key, c.said, text, c.unsaid))).toBe(drawn(text, c.meant));
      });

      it(`${key} (${header}): the source wins over the caller's option`, () => {
        expect(drawn(globally(key, c.said, text), c.unmeant)).toBe(drawn(text, c.meant));
      });

      it(`${key} (${header}): a value it cannot read says nothing, and the bare name is not read`, () => {
        expect(drawn(globally(key, "sideways", text))).toBe(drawn(text));
        expect(drawn(globally(c.name, c.said, text))).toBe(drawn(text));
      });
    }
  }

  it("m2t_borders: borderless reaches a sequence through its own section, not another kind's", () => {
    const text = "sequenceDiagram\n  Alice->>Bob: hi\n  note over Alice: thought\n";
    expect(render(text, { borders: "borderless" })).not.toBe(render(text));
    expect(render(withConfig({ sequence: { m2t_borders: "borderless" } }, text))).toBe(render(text, { borders: "borderless" }));
    expect(render(withConfig({ flowchart: { m2t_borders: "borderless" } }, text))).toBe(render(text));
  });

  it("m2t_bands: zero or a fraction is not a count of bands", () => {
    const text = `flowchart LR\n${CHAIN}`;
    expect(render(globally("m2t_bands", "0", text))).toBe(render(text));
    expect(render(globally("m2t_bands", "1.5", text))).toBe(render(text));
  });
});
