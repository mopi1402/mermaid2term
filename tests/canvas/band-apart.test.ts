import { describe, expect, it } from "vitest";
import { BAND_MARK, bandApart } from "../../src/canvas/keys.js";

describe("bandApart", () => {
  it("leaves a key with no band whole", () => {
    expect(bandApart("node@rim")).toEqual(["node@rim", ""]);
  });

  it("takes the last band off with its mark", () => {
    expect(bandApart(`node${BAND_MARK}a${BAND_MARK}b`)).toEqual([`node${BAND_MARK}a`, `${BAND_MARK}b`]);
  });
});
