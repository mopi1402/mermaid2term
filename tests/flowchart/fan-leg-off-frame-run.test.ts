import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { drawings, mergedCells } from "../invariants/geometry.js";

const SOURCE = readFileSync(new URL("../../fixtures/flowchart/cluster-lanes-lr.stress.mmd", import.meta.url), "utf8");

describe("a fan leg left alone on its box's centre row still turns off it", () => {
  it.each(["LR", "RL"])("in %s, `Server --> F` leaves the frame on a row `D <--> Data` does not ride", (direction) => {
    const source = SOURCE.replace("flowchart LR", `flowchart ${direction}`);
    const shared = [...drawings(source)]
      .filter((d) => d.borders === "padless")
      .flatMap((d) => mergedCells(d).map((cell) => `${d.gap}/${d.paddingX} ${cell}`))
      .filter((cell) => cell.includes("Server->F") && cell.includes("D->Data"));
    expect(shared).toEqual([]);
  });
});
