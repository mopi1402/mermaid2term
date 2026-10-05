import { describe, expect, it } from "vitest";

import { renderThemed } from "../../src/index.js";
import { withConfig } from "../support/frontmatter.js";

const painted = (source: string): string => renderThemed(source, { width: 80, background: "dark" }, "default");
const fronted = (config: string, body: string): string => withConfig(`${config}\n`, body);
const FLOW = "flowchart LR\n  A --> B";
const CLASS = "classDiagram\n  class A\n  class B\n  A <|-- B";

describe("a theme set in the diagram's own config section, as mermaid 12 reads it (#8193)", () => {
  it("paints a flowchart under `config.flowchart.theme` as under the global `theme`", () => {
    expect(painted(fronted("  flowchart:\n    theme: forest", FLOW))).toEqual(painted(fronted("  theme: forest", FLOW)));
    expect(painted(fronted("  flowchart:\n    theme: forest", FLOW))).not.toEqual(painted(FLOW));
  });

  it("puts the diagram's own theme over the global one", () => {
    expect(painted(fronted("  theme: dark\n  flowchart:\n    theme: forest", FLOW))).toEqual(painted(fronted("  theme: forest", FLOW)));
  });

  it("reads it off an init directive too, and for a kind with its own section", () => {
    expect(painted(`%%{init: {"flowchart": {"theme": "forest"}}}%%\n${FLOW}`)).toEqual(painted(fronted("  theme: forest", FLOW)));
    expect(painted(fronted("  class:\n    theme: forest", CLASS))).toEqual(painted(fronted("  theme: forest", CLASS)));
  });

  it("leaves a theme under another kind's section unread", () => {
    expect(painted(fronted("  class:\n    theme: forest", FLOW))).toEqual(painted(FLOW));
  });
});
