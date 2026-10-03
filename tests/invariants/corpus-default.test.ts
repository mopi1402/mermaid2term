import { describe } from "vitest";
import { holdsOverCorpus } from "./corpus.js";
import { RULES } from "./rulebook.js";

describe("the corpus holds every ground rule, default", () => holdsOverCorpus("default", RULES));
