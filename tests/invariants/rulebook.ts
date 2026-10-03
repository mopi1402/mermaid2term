import { type Rule } from "./corpus.js";
import { dashBreaches, edgeWallBreaches, holeBreaches, wordGroundBreaches } from "./rules.js";

// Every rule the corpus is held to, by what it says.
export const RULES: Readonly<Record<string, Rule>> = {
  "an edge wall's free part shows the fill it closes": edgeWallBreaches,
  "no page shows through a hole in a filled object": holeBreaches,
  "a word stands on its container's ground": wordGroundBreaches,
  "an outline is dashed all round or not at all": dashBreaches,
};
