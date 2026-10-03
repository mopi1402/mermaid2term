import { drawnChecks, told } from "./drawn-checks.js";
import { remember } from "./memo.js";

const { arrows, merges } = await drawnChecks();
if (arrows.defects === 0) remember("arrows");
told(merges, "cell(s) where two arrows melt into one line. Two edges are NEVER one line.");
