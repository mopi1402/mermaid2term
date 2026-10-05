import { describe, expect, it } from "vitest";
import { renderThemed } from "../../src/index.js";

// Two styles mermaid 12 copies onto the SVG where nothing shows are drawn here as their author meant them
// (`docs/divergences.md`): a class diagram's `classDef` worn through `cssClass`, and `background-color` as a fill.
const drawn = (source: string): string => renderThemed(source, { width: 80, background: "light" }, "default");

describe.each(["TB", "LR"])("styles mermaid leaves unseen are drawn, %s", (direction) => {
  it("paints a class wearing a classDef, as its style would", () => {
    const body = `classDiagram\n  direction ${direction}\n  class Order {\n    +int id\n  }`;
    expect(drawn(`${body}\n  classDef hot fill:#ffd6d6,stroke:#e03131\n  cssClass "Order" hot`)).toBe(drawn(`${body}\n  style Order fill:#ffd6d6,stroke:#e03131`));
  });

  it("reads background-color as a fill", () => {
    const body = `flowchart ${direction === "TB" ? "TD" : "LR"}\n  A[Order] --> B[Invoice]`;
    expect(drawn(`${body}\n  style A background-color:#ffd6d6`)).toBe(drawn(`${body}\n  style A fill:#ffd6d6`));
  });
});
