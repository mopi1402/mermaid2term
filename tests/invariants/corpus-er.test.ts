import { describe } from "vitest";
import { holdsOverKind } from "./corpus.js";
import { crossingBreaches } from "./rules.js";

describe("the ER corpus never crosses two strokes in one cell", () =>
  holdsOverKind("erDiagram", { "no stroke crosses another": crossingBreaches }));
