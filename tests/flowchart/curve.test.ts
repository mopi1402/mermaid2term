import { describe, it, expect } from "vitest";

import { render } from "../../src/index.js";
import { configured } from "../../src/source/source.js";
import { withConfig } from "../support/frontmatter.js";

const WIDTH = 80;
const drawn = (source: string, roundedEdges?: boolean): string =>
  render(source, roundedEdges === undefined ? { width: WIDTH } : { width: WIDTH, roundedEdges });
const curved = (curve: string, layout = "  layout: dagre\n"): string => `${layout}  flowchart:\n    curve: ${curve}\n`;

const flowchart = (direction: string): string => `flowchart ${direction}\n    A --> B\n    A --> C\n    B --> D\n    C --> D\n`;
const STATE = "stateDiagram-v2\n    A --> B\n    A --> C\n    B --> D\n    C --> D\n";

const SHARP = ["linear", "step", "stepAfter", "stepBefore"];
const ROUNDED = ["basis", "bumpX", "bumpY", "cardinal", "catmullRom", "monotoneX", "monotoneY", "natural", "rounded"];

// mermaid 12 draws `curve` under `layout: dagre` alone: `elk`, its default, rounds every corner whatever it says.
describe.each(["TD", "LR"])("`flowchart.curve` on a flowchart %s", (direction) => {
  const body = flowchart(direction);

  it("draws the two corners apart, so the cases below bite", () => {
    expect(drawn(body, false)).not.toBe(drawn(body, true));
  });

  it.each(SHARP)("turns sharp under `%s`, over the caller's rounded corners", (curve) => {
    expect(drawn(withConfig(curved(curve), body), true)).toBe(drawn(withConfig({ layout: "dagre" }, body), false));
  });

  it.each(ROUNDED)("stays rounded under `%s`, over the caller's sharp corners", (curve) => {
    expect(drawn(withConfig(curved(curve), body), false)).toBe(drawn(withConfig({ layout: "dagre" }, body), true));
  });

  it("reads the flowchart's own `layout` and the init directive alike", () => {
    const own = withConfig({ flowchart: { layout: "dagre", curve: "linear" } }, body);
    expect(drawn(own)).toBe(drawn(body, false));
    expect(drawn(`%%{init: {"layout": "dagre", "flowchart": {"curve": "linear"}}}%%\n${body}`)).toBe(drawn(body, false));
  });

  it("says nothing under `elk`, mermaid 12's default layout", () => {
    expect(drawn(withConfig(curved("linear", ""), body))).toBe(drawn(body));
    expect(drawn(withConfig(curved("basis", "  layout: elk\n"), body), false)).toBe(drawn(body, false));
  });
});

// mermaid 12's state and class diagrams draw with the flowchart's `curve` under dagre, their own section having none.
describe("`flowchart.curve` on a state diagram", () => {
  it("turns its corners sharp under `linear`", () => {
    expect(drawn(STATE, false)).not.toBe(drawn(STATE));
    expect(drawn(withConfig(curved("linear"), STATE))).toBe(drawn(STATE, false));
  });
});

// The class renderer rounds its corners whatever `roundedEdges` says, so the key is read and checked here.
describe("`flowchart.curve` on a class diagram", () => {
  it("reads sharp corners under `linear` and rounded ones under `basis`", () => {
    const body = "classDiagram\n    A --> B\n";
    expect(configured(withConfig(curved("linear"), body), {}, "class").roundedEdges).toBe(false);
    expect(configured(withConfig(curved("basis"), body), { roundedEdges: false }, "class").roundedEdges).toBe(true);
    expect(configured(withConfig(curved("linear", ""), body), {}, "class").roundedEdges).toBe(undefined);
  });
});
