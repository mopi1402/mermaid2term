import { describe } from "vitest";
import { holdsOverKind } from "./corpus.js";
import { crossingBreaches, titleOverLineBreaches } from "./rules.js";

describe("the state corpus never crosses two strokes in one cell nor writes a title over a line", () =>
  holdsOverKind("stateDiagram", { "no stroke crosses another": crossingBreaches, "no title covers a line": titleOverLineBreaches }));
