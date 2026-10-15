import { describe, expect, it } from "vitest";
import { render, renderThemedText } from "../../src/index.js";
import { TWO_PANES, widest } from "../support/drawn.js";

const SOURCE = `architecture-beta
    service db(database)[The primary relational database of record]
    service api(server)[The public facing application server]
    db:R -- L:api
`;

// An architecture goes through the engine as a flowchart does: its labels fold under the width budget and a
// painted drawing keeps every option the fit ladder hands it.
describe("an architecture diagram under a width budget", () => {
  it.each(TWO_PANES)("folds its labels to hold width %i, plain and painted", (width) => {
    expect(widest(render(SOURCE, { width }))).toBeLessThanOrEqual(width);
    expect(widest(renderThemedText(SOURCE, { width }, "default").plain)).toBeLessThanOrEqual(width);
  });

  it.each(TWO_PANES)("keeps the border mode when painted (width %i)", (width) => {
    const plain = render(SOURCE, { width, borders: "padless" });
    expect(renderThemedText(SOURCE, { width, borders: "padless" }, "default").plain.split("\n")[0]).toBe(plain.split("\n")[0]);
  });
});
