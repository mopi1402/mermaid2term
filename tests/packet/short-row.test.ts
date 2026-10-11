import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { render } from "../../src/index.js";
import { TWO_PANES } from "../support/drawn.js";

const PACKET = readFileSync("fixtures/packet/relative.mmd", "utf8");

describe("a packet row mermaid leaves short", () => {
  it.each(TWO_PANES)("numbers a lone one-bit field once and closes its frame on it, at width %i", (width) => {
    const rows = render(PACKET, { width }).split("\n");
    const at = rows.findIndex((row) => row.trim() === "32");
    expect(at).toBeGreaterThan(0);
    expect(rows[at + 1].trim()).toBe("╭──╮");
    expect(rows[at + 2].trim()).toBe("│F │");
  });
});
