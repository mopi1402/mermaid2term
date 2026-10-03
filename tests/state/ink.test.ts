import { describe, it, expect } from "vitest";
import { render, renderThemed } from "../../src/index.js";
import { parseStateDiagram } from "../../src/diagrams/statediagram/parser.js";
import { nodeProps } from "../../src/graph/render/nodes.js";
import { must } from "../../src/must.js";

describe("a state wearing a classDef, the class read off the name and not as part of it", () => {
  const source = `stateDiagram-v2
    [*] --> Draft
    Review --> Approved:::good : approve
    Review --> Rejected : reject
    Standby:::bad
    class Rejected,Missing bad
    classDef good fill:#14532d,stroke:#22c55e
    classDef bad fill:#7f1d1d,stroke:#ef4444
`;

  it("keeps the class on the state and the label whole", () => {
    const graph = parseStateDiagram(source);
    expect(graph.nodes.get("Approved")?.styleClasses).toEqual(["good"]);
    expect(graph.nodes.get("Approved")?.label).toBe("Approved");
    expect(graph.edges.find((e) => e.target === "Approved")?.label).toBe("approve");
  });

  it("reads a classDef and a class list the way the flowchart does", () => {
    const graph = parseStateDiagram(source);
    expect(graph.classDefs.get("good")?.get("stroke")).toBe("#22c55e");
    expect(graph.nodes.get("Rejected")?.styleClasses).toEqual(["bad"]);
    expect(graph.nodes.has("Missing")).toBe(false);
    expect(graph.nodes.get("Standby")?.styleClasses).toEqual(["bad"]);
  });

  it("draws the same glyphs with the classes as without them", () => {
    const bare = source.replaceAll(":::good", "").replaceAll(":::bad", "");
    expect(render(source, { width: 60 })).toBe(render(bare, { width: 60 }));
  });
});

describe("the class list and the accessibility lines of mermaid's own classDef example", () => {
  const source = `stateDiagram
    direction TB
    accTitle: This is the accessible title
    accDescr: This is an accessible description
    classDef movement font-style:italic
    classDef badBadEvent fill:#f00,color:white,stroke-width:2px
    [*]--> Still
    Still --> Moving
    Moving --> Crash
    Crash --> [*]
    class Moving, Crash movement
    class Crash badBadEvent
`;

  it("reads `class Moving, Crash movement` with the blank after the comma, the style being the last word", () => {
    const graph = parseStateDiagram(source);
    expect(graph.nodes.get("Moving")?.styleClasses).toEqual(["movement"]);
    expect(graph.nodes.has("Crash,")).toBe(false);
  });

  it("gives a state wearing two classes the props of both, the later over the earlier", () => {
    const graph = parseStateDiagram(source);
    const props = nodeProps(graph, "Crash", graph.nodes.get("Crash")?.styleClasses ?? []);
    expect(props?.get("font-style")).toBe("italic");
    expect(props?.get("fill")).toBe("#f00");
  });

  it("mints no state for `class end badBadEvent`, as mermaid draws none", () => {
    const graph = parseStateDiagram(source + "    class end badBadEvent\n");
    expect(graph.nodes.has("end")).toBe(false);
  });

  it("draws no state for accTitle, accDescr, nor an `accDescr {` block", () => {
    const graph = parseStateDiagram(source);
    expect([...graph.nodes.keys()].filter((id) => !id.startsWith("[*]"))).toEqual(["Still", "Moving", "Crash"]);
    const block = parseStateDiagram("stateDiagram-v2\n    accDescr {\n        Two lines\n        of text\n    }\n    [*] --> A\n");
    expect([...block.nodes.keys()].filter((id) => !id.startsWith("[*]"))).toEqual(["A"]);
  });
});

describe("a colour NAMED in a classDef, which the terminal writer read as a six digit hex", () => {
  const source = `stateDiagram
    classDef notMoving fill:white
    classDef badBadEvent fill:red,stroke:yellow
    [*] --> Still
    Still --> Crash
    class Still notMoving
    class Crash badBadEvent
`;

  it("paints the name's value, as the sequence and class engines already did", () => {
    const drawn = renderThemed(source, { width: 40 }, "classic");
    expect(drawn).toContain("48;2;255;0;0");
    expect(drawn).toContain("48;2;255;255;255");
    expect(drawn).toContain("38;2;255;255;0");
  });
});

describe("a label laid on a FILL, weighed against it the way every ink over a box already was", () => {
  const source = `stateDiagram
    classDef notMoving fill:white
    classDef badBadEvent fill:#f00,color:white
    [*] --> Still
    Still --> Crash
    class Still notMoving
    class Crash badBadEvent
`;
  const inks = (drawn: string): Map<string, string> => {
    const seen = new Map<string, string>();
    for (const run of drawn.matchAll(/\u001b\[([0-9;:]*)m([A-Za-z])/gu)) seen.set(run[2], run[1]);
    return seen;
  };

  it("darkens the theme's white label over a white fill, and keeps the author's white over red", () => {
    const seen = inks(renderThemed(source, { width: 40 }, "classic"));
    const still = must(seen.get("S"));
    expect(still).toContain("48;2;255;255;255");
    expect(still).not.toContain("38;2;255;255;255");
    expect(seen.get("C")).toContain("38;2;255;255;255;48;2;255;0;0");
  });
});
