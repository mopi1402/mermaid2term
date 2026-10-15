import { describe } from "vitest";
import { holdsOverKind } from "./corpus.js";
import { crossingBreaches } from "./rules.js";

describe("the block corpus never crosses two strokes in one cell", () =>
  holdsOverKind("block", { "no stroke crosses another": crossingBreaches }));
