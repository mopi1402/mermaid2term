import { describe, expect, it } from "vitest";

import { TOO_WIDE } from "../../src/cli/console.js";

describe("the too-wide warning", () => {
  it("offers a vertical layout to a flowchart", () => {
    expect(TOO_WIDE(60, 40, "flowchart")).toContain("graph TD");
  });

  it.each(["treemap", "kanban", "xychart", undefined])("never offers one to %s, which has no direction to turn", (kind) => {
    const warned = TOO_WIDE(60, 40, kind);
    expect(warned).not.toContain("graph TD");
    expect(warned).toContain("less -S");
  });
});
