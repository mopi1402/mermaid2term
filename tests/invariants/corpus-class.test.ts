import { describe } from "vitest";
import { holdsOverKind } from "./corpus.js";
import { crossingBreaches, titleOverLineBreaches } from "./rules.js";

describe("the class corpus never crosses two strokes in one cell nor writes a title over a line", () =>
  holdsOverKind("classDiagram", { "no stroke crosses another": crossingBreaches, "no title covers a line": titleOverLineBreaches }));
