import { describe } from "vitest";
import { holdsOverKind } from "./corpus.js";
import { titleOverLineBreaches } from "./rules.js";

describe("the architecture corpus never writes a group title over a line", () =>
  holdsOverKind("architecture", { "no title covers a line": titleOverLineBreaches }));
