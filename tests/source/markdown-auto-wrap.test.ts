import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";
import { withConfig } from "../support/frontmatter.js";

const LABEL = "one two three four five six seven eight nine ten eleven twelve thirteen";

const holds = (source: string, text: string): boolean =>
  render(source, { width: 200 }).split("\n").some((row) => row.includes(text));

const unwrapped = (body: string): string => withConfig({ markdownAutoWrap: false }, body);

// Measured on mermaid 12.0.0 headless: a markdown label is 428px on one line under the key, 120px wrapped without it.
describe("mermaid 12's top-level `markdownAutoWrap: false` keeps a markdown label on one line", () => {
  it.each(["LR", "TD"])("lays a fenced flowchart label on one row, a plain one still wrapping (%s)", (dir) => {
    const body = `flowchart ${dir}\n  A["\`${LABEL}\`"] --> B["${LABEL}"]`;
    const source = unwrapped(body);
    expect(render(source, { width: 200 }).split("\n").filter((row) => row.includes(LABEL))).toHaveLength(1);
    expect(holds(body, LABEL)).toBe(false);
  });

  it.each(["LR", "TD"])("reads the init directive the same way (%s)", (dir) => {
    const source = `%%{init: {"markdownAutoWrap": false}}%%\nflowchart ${dir}\n  A["\`${LABEL}\`"] --> B[court]`;
    expect(holds(source, LABEL)).toBe(true);
  });

  it.each(["LR", "TD"])("leaves an `@{ label }` and an HTML-tagged label wrapped, as mermaid does (%s)", (dir) => {
    const source = unwrapped(`flowchart ${dir}\n  A@{ label: "\`${LABEL}\`" } --> B["<b>x</b> ${LABEL}"]`);
    expect(holds(source, LABEL)).toBe(false);
  });

  it.each(["LR", "TD"])("lays a state's label on one row, a fenced one still wrapping (%s)", (dir) => {
    const body = `stateDiagram-v2\n  direction ${dir}\n  s1 : ${LABEL}\n  state "\`${LABEL}\`" as s2\n  s1 --> s2`;
    expect(render(unwrapped(body), { width: 200 }).split("\n").filter((row) => row.includes(LABEL))).toHaveLength(1);
    expect(holds(body, LABEL)).toBe(false);
  });

  // Measured on mermaid 12.0.0 headless: every mindmap node, each shape, fenced, quoted or plain, one 24px line under the key.
  it.each([200, 120])("lays every mindmap node on one row, whatever its shape (width %i)", (width) => {
    const body = `mindmap\n  root((${LABEL}))\n    a[${LABEL}]\n    b(${LABEL})\n    c))${LABEL}((\n    d)${LABEL}(\n    e{{${LABEL}}}\n    f["\`${LABEL}\`"]\n    g\n      ${LABEL}`;
    const count = (source: string): number => render(source, { width }).split(LABEL).length - 1;
    expect(count(unwrapped(body))).toBe(8);
    expect(count(body)).toBe(0);
  });
});
