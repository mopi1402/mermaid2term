import { describe, expect, it } from "vitest";
import { writeDirection, readDirection } from "@/direction";

describe("the direction read in the source", () => {
  it("reads a flowchart header, TD included, and nothing when it says nothing", () => {
    expect(readDirection("flowchart LR\n    A --> B")?.current).toBe("LR");
    expect(readDirection("graph TD;\n    A --> B")?.current).toBe("TB");
    expect(readDirection("flowchart\n    A --> B")?.current).toBeUndefined();
    expect(readDirection("flowchart\n    A --> B")?.options).toEqual(["TB", "LR", "RL", "BT"]);
  });

  it("reads the `direction` line of a state diagram, outside composites", () => {
    expect(readDirection("stateDiagram-v2\n    direction LR\n    [*] --> A")?.current).toBe("LR");
    expect(readDirection("stateDiagram-v2\n    state X {\n        direction LR\n        a\n    }\n")?.current).toBeUndefined();
    expect(readDirection("classDiagram\n    direction RL\n    class A")?.current).toBe("RL");
    expect(readDirection("erDiagram\n    A ||--o{ B : has")?.current).toBeUndefined();
  });

  it("offers gitGraph its three headings and the timeline its two", () => {
    expect(readDirection("gitGraph LR:\n    commit")).toEqual({ options: ["TB", "LR", "BT"], current: "LR" });
    expect(readDirection("timeline TD\n    title x")).toEqual({ options: ["TB", "LR"], current: "TB" });
  });

  it("answers nothing for a family without direction, nor for an empty source", () => {
    expect(readDirection("sequenceDiagram\n    A->>B: hi")).toBeUndefined();
    expect(readDirection("pie\n    \"a\" : 1")).toBeUndefined();
    expect(readDirection("")).toBeUndefined();
  });

  it("skips frontmatter and directives before the header", () => {
    const source = "---\ntitle: x\n---\n%%{init: {}}%%\nflowchart RL\n    A --> B";
    expect(readDirection(source)?.current).toBe("RL");
  });
});

describe("the direction written in the source", () => {
  it("writes and replaces after a flowchart keyword, touching nothing else", () => {
    expect(writeDirection("flowchart\n    A --> B", "LR")).toBe("flowchart LR\n    A --> B");
    expect(writeDirection("flowchart TD\n    A --> B", "BT")).toBe("flowchart BT\n    A --> B");
    expect(writeDirection("graph LR;\n    A --> B", "TB")).toBe("graph TB;\n    A --> B");
  });

  it("removes the direction for Default, handing back to autorotate", () => {
    expect(writeDirection("flowchart LR\n    A --> B", undefined)).toBe("flowchart\n    A --> B");
    expect(writeDirection("stateDiagram-v2\n    direction LR\n    [*] --> A", undefined)).toBe("stateDiagram-v2\n    [*] --> A");
    expect(writeDirection("gitGraph LR:\n    commit", undefined)).toBe("gitGraph\n    commit");
  });

  it("inserts the `direction` line under the header, aligned with the body, or replaces it", () => {
    expect(writeDirection("stateDiagram-v2\n  [*] --> A", "LR")).toBe("stateDiagram-v2\n  direction LR\n  [*] --> A");
    expect(writeDirection("stateDiagram-v2\n    direction LR\n    [*] --> A", "BT")).toBe(
      "stateDiagram-v2\n    direction BT\n    [*] --> A"
    );
    const composite = "stateDiagram-v2\n    state X {\n        direction LR\n        a\n    }";
    expect(writeDirection(composite, "RL")).toBe("stateDiagram-v2\n    direction RL\n    state X {\n        direction LR\n        a\n    }");
  });

  it("writes what each family expects: `LR:` for gitGraph, `TD` for the timeline", () => {
    expect(writeDirection("gitGraph\n    commit", "BT")).toBe("gitGraph BT:\n    commit");
    expect(writeDirection("gitGraph LR:\n    commit", "TB")).toBe("gitGraph TB:\n    commit");
    expect(writeDirection("timeline\n    title x", "TB")).toBe("timeline TD\n    title x");
    expect(writeDirection("timeline TD\n    title x", "LR")).toBe("timeline LR\n    title x");
  });

  it("hands the source back unchanged to a family without direction", () => {
    expect(writeDirection("sequenceDiagram\n    A->>B: hi", "LR")).toBe("sequenceDiagram\n    A->>B: hi");
  });

  it("writes after the header even past a frontmatter", () => {
    const source = "---\ntitle: x\n---\nflowchart\n    A --> B";
    expect(writeDirection(source, "LR")).toBe("---\ntitle: x\n---\nflowchart LR\n    A --> B");
  });
});
