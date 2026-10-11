import { describe, expect, it } from "vitest";
import { renderThemedText } from "../../src/index.js";

const SOURCE = 'packet-beta\n  title Hdr\n  0-15: "Source"\n  16-31: "Dest"\n';

const styleOf = (theme: string, background: "light" | "dark", ch: string): string | undefined =>
  renderThemedText(SOURCE, { width: 80, background }, theme).rows.flat().find((cell) => cell.ch === ch)?.style;

// mermaid 12's packet sheet: `labelColor` and `titleColor` default to `black`, and only `theme-dark.js` and
// `theme-forest.js` state them, as their `primaryTextColor`.
describe("a packet's field names and title fall back as mermaid's", () => {
  it("writes default's in black, never its textColor", () => {
    expect(styleOf("default", "light", "S")).toBe("bold black");
    expect(styleOf("default", "light", "H")).toBe("bold black");
  });

  it("writes forest's and dark's in their primaryTextColor", () => {
    expect(styleOf("forest", "light", "S")).toBe("bold #321B67");
    expect(styleOf("dark", "dark", "H")).toBe("bold #E0DFDF");
  });

  it("weighs the black to read on a dark page", () => {
    expect(styleOf("neo-dark", "dark", "S")).not.toMatch(/black|#000000/iu);
  });
});
