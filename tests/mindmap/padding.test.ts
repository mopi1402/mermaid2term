import { describe, expect, it } from "vitest";
import { render, renderThemed } from "../../src/index.js";
import { withConfig } from "../support/frontmatter.js";

const body = "mindmap\n  root((Root))\n    Alpha\n      One\n      Two\n    Beta\n    Gamma\n      Three\n    Delta\n    Epsilon\n";
const padded = (px: string): string => withConfig({ mindmap: { padding: px } }, body);

// mermaid 12's `mindmap.padding` grows some shapes and not others; our nodes draw no shape, so it is left unread.
describe("mindmap padding", () => {
  it.each([40, 120])("draws what no padding draws, at %i columns", (width) => {
    for (const px of ["0", "10", "30"]) {
      expect(render(padded(px), { width })).toBe(render(body, { width }));
      expect(renderThemed(padded(px), { width }, "default")).toBe(renderThemed(body, { width }, "default"));
    }
  });
});
