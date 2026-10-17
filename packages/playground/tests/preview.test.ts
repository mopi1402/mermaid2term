import { describe, it, expect } from "vitest";
import { draw, settings } from "@/Diagram";

describe("the mermaid preview", () => {
  it("runs mermaid strict, so a `javascript:` link a shared address carries stays dead", () => {
    expect(settings("default").securityLevel).toBe("strict");
  });

  it("skips a render nobody waits for any more, before mermaid is even loaded", async () => {
    await expect(draw("stale", "graph TD\n  A --> B", "default", () => true)).resolves.toBeUndefined();
  });
});
