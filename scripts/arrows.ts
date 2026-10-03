import { drawnChecks, told } from "./drawn-checks.js";
import { remember } from "./memo.js";

const { arrows, merges } = await drawnChecks();
if (merges.defects === 0) remember("merges");
told(arrows, "head(s) badly fed or run through. Every direction change draws its corner, and a head's cell is nobody else's, EVERY time.");
