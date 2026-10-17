import { describe, it, expect } from "vitest";
import { INITIAL_SOURCE, addressAt } from "@/hash";

describe("the address followed back", () => {
  it("brings the opening source back on a bare address, no fixture selected", async () => {
    await expect(addressAt("")).resolves.toEqual({ name: undefined, source: INITIAL_SOURCE });
  });
});
