import { describe, expect, it } from "vitest";
import { jsonToMermaid } from "../../src/cli/ingest.js";

describe("a JSON payload's null crosses the boundary once and is written nowhere", () => {
  it("drops a key whose value is null, rather than printing it or throwing", () => {
    expect(jsonToMermaid('{"a": null, "b": "x"}', "treemap")).toBe('treemap-beta\n    "b": x');
  });

  it("drops a null from a series, keeping the numbers", () => {
    expect(jsonToMermaid('{"bar": [1, null, 3]}', "xychart")).toBe("xychart-beta\n    x-axis [1, 2, 3]\n    bar [1, 3]");
  });

  it("reads a null label as no label", () => {
    expect(jsonToMermaid('[{"from": "A", "to": "B", "label": null}]', "flowchart")).toBe("graph TD\n    A-->B");
  });

  it("writes a number as JavaScript does, `30` and `30.5` alike", () => {
    expect(jsonToMermaid('{"A": 30.0, "B": 70.5}', "pie")).toBe('pie\n    "A" : 30\n    "B" : 70.5');
  });
});
