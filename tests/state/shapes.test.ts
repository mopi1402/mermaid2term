import { describe, it, expect } from "vitest";
import { render } from "../../src/index.js";
import { parseStateDiagram } from "../../src/diagrams/statediagram/parser.js";

describe("a state described on its own line, `id : description`, which used to be dropped", () => {
  it("names the state by its description, written before or after the transitions", () => {
    const before = parseStateDiagram("stateDiagram-v2\n    s2 : This is a state description\n    [*] --> s2\n");
    expect(before.nodes.get("s2")?.label).toBe("This is a state description");
    const after = parseStateDiagram("stateDiagram-v2\n    [*] --> s2\n    s2 : This is a state description\n");
    expect(after.nodes.get("s2")?.label).toBe("This is a state description");
    expect(after.nodes.size).toBe(2);
  });

  it("names a composite the same way, before or after its body, and keeps the class written between", () => {
    const graph = parseStateDiagram(
      "stateDiagram-v2\n    Named: Another Composite\n    state Named {\n        a --> b\n        b: Bee\n    }\n    Later: Named later\n    state Later {\n        c\n    }\n    s2:::warn : Described\n"
    );
    expect(graph.findSubgraphById("Named")?.label).toBe("Another Composite");
    expect(graph.findSubgraphById("Later")?.label).toBe("Named later");
    expect(graph.nodes.get("b")?.label).toBe("Bee");
    expect(graph.nodes.get("s2")?.label).toBe("Described");
    expect(graph.nodes.get("s2")?.styleClasses).toEqual(["warn"]);
  });

  it("sends a transition written against a composite to the box, and mints no state of that name", () => {
    const graph = parseStateDiagram("stateDiagram-v2\n    [*] --> First\n    state First {\n        [*] --> second\n    }\n");
    expect(graph.nodes.has("First")).toBe(false);
    const edge = graph.edges.find((e) => e.target === "First");
    expect(edge?.targetIsSubgraph).toBe(true);
  });

  it("leaves a transition's own label to the transition", () => {
    const graph = parseStateDiagram("stateDiagram-v2\n    a --> b : go\n");
    expect(graph.edges[0]?.label).toBe("go");
    expect(graph.nodes.get("a")?.label).toBe("a");
  });
});

describe("a fork/join drawn as the BAR mermaid means, not a box filled with rules", () => {
  const forked = (dir: string): string =>
    "stateDiagram-v2\n    direction " + dir + "\n    state fork1 <<fork>>\n    state join1 <<join>>\n" +
    "    [*] --> fork1\n    fork1 --> Charge\n    fork1 --> Journal\n    Charge --> join1\n" +
    "    Journal --> join1\n    join1 --> [*]\n";

  it("draws a bar ONE row thin down the page, the head against it and the departure out of it", () => {
    const lines = render(forked("TB"), { width: 120 }).split("\n");
    const bars = lines.map((l, i) => [l, i] as const).filter(([l]) => l.includes("█"));
    expect(bars.length).toBe(2);
    for (const [l] of bars) expect(l).not.toContain("━");
    const join = bars[1]![1];
    expect(lines[join - 1]).toContain("⏷");
    expect(lines[join + 1]).toContain("│");
    expect(lines[join + 1]).not.toContain("┬");
  });

  it("draws a bar ONE column thin across, the flow reading straight through it", () => {
    const drawn = render(forked("LR"), { width: 120 });
    expect(drawn).not.toContain("━");
    expect(drawn).toContain("⏵█");
    expect(drawn).toContain("█─");
    for (const line of drawn.split("\n")) expect(line).not.toContain("██");
  });
});

describe("a state's note is a NODE of the drawing, tethered by a dotted line, on the side the author named", () => {
  const source =
    "stateDiagram-v2\n    direction LR\n    State1: The state with a note\n    note right of State1\n" +
    "        Important information! You can write\n        notes.\n    end note\n    State1 --> State2\n" +
    "    note left of State2 : This is the note to the left.\n";

  it("reads a block note and tethers it to the right of its state", () => {
    const drawn = render(source, { width: 120 });
    expect(drawn).toMatch(/note\s+├┄+┤/u);
    // The break the author typed between the two lines of the block is kept, as mermaid keeps it: its
    // `nonMarkdownToHTML` turns a newline into a `<br />`, and only what overflows the box is wrapped.
    expect(drawn).toContain("write");
    expect(drawn).toMatch(/notes\./u);
  });

  it("puts a `left of` note in the layer before its state, tethered from its right side", () => {
    const drawn = render(source, { width: 120 });
    const rows = drawn.split("\n");
    const tether = rows.findIndex((r) => r.includes("the left."));
    expect(rows[tether + 1]).toMatch(/├┄+┤/u);
    const note = rows.findIndex((r) => r.includes("This is the note"));
    const state = rows.findIndex((r) => r.includes("State2"));
    expect(rows[note].indexOf("This is the note")).toBeLessThan(rows[state].indexOf("State2"));
  });

  it("keeps the note whole and every box untouched", () => {
    const drawn = render(
      "stateDiagram-v2\n    note right of Loading : fetches the manifest\n    Loading --> Ready\n    Ready --> Closed\n",
      { width: 200 }
    );
    expect(drawn).toContain("fetches the");
    expect(drawn).toContain("manifest");
    expect(drawn).toMatch(/│\s+Ready\s+├─+⏵│\s+Closed\s+│/u);
  });
});

describe("a composite naming no direction, under a diagram running up or leftwards", () => {
  const source = "stateDiagram\n    direction BT\n    [*] --> A\n    A --> B\n    B --> C\n    state B {\n      a --> b\n    }\n    B --> D\n";

  it("starts over at the terminal's default and reads a then b across, not b over a", () => {
    const drawn = render(source, { width: 80 });
    expect(drawn).toMatch(/│\s+a\s+├─+⏵│\s+b\s+│/u);
    const rows = drawn.split("\n");
    expect(rows.findIndex((r) => r.includes("  A  "))).toBeGreaterThan(rows.findIndex((r) => r.includes("  a  ")));
  });

  it("reads a then b under RL too, the mirror having turned it back", () => {
    expect(render(source.replace("BT", "RL"), { width: 100 })).toMatch(/│\s+a\s+├─+⏵│\s+b\s+│/u);
  });

  it("still inherits under a diagram running down, as mermaid's default and ours agree there", () => {
    const rows = render(source.replace("BT", "TB"), { width: 80 }).split("\n");
    expect(rows.findIndex((r) => r.includes("  a  "))).toBeLessThan(rows.findIndex((r) => r.includes("  b  ")));
    expect(rows.some((r) => /│\s+a\s+├─+⏵│\s+b\s+│/u.test(r))).toBe(false);
  });
});

describe("a composite's own `direction` line, under each direction the diagram can run", () => {
  const roots = ["TB", "BT", "LR", "RL"];
  const inners = ["TB", "BT", "LR", "RL"];
  const seat = (rows: string[], id: string): [number, number] => {
    const row = rows.findIndex((r) => r.includes(`  ${id}  `));
    return [row, row < 0 ? -1 : rows[row].indexOf(`  ${id}  `)];
  };
  const sense = (rows: string[]): string => {
    const [ar, ac] = seat(rows, "a");
    const [br, bc] = seat(rows, "b");
    if (ar === br) return ac < bc ? "LR" : "RL";
    return ar < br ? "TB" : "BT";
  };
  const source = (root: string, inner: string): string =>
    `stateDiagram\n    direction ${root}\n    [*] --> A\n    A --> B\n    B --> C\n    state B {\n      direction ${inner}\n      a --> b\n    }\n    B --> D\n`;

  for (const root of roots) {
    it(`under ${root}, a composite reads its own line and not the diagram's: it used to turn the whole diagram`, () => {
      for (const inner of inners) {
        const rows = render(source(root, inner), { width: 120 }).split("\n");
        expect(sense(rows), `root ${root}, composite ${inner}`).toBe(inner);
      }
    });
  }
});
