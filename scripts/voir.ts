import { render, renderThemed, THEMES } from "../src/index.js";
import { must } from "../src/must.js";
import { corpus, DRAWN } from "./corpus.js";

const sources = new Map(corpus(DRAWN).map(({ id, source }) => [id, source]));
// The theme word that asks for the plain drawing, no theme at all.
const PLAIN = "text";

const [wanted = "sequence/participant-types", theme = "neon", columns] = process.argv.slice(2);

let found = sources.get(wanted);
if (found === undefined) {
  const candidates = [...sources.keys()].filter((name) => name.includes(wanted));
  if (candidates.length === 1) found = sources.get(candidates[0]);
  else {
    const listed = (candidates.length > 0 ? candidates : [...sources.keys()]).sort().join("\n  ");
    console.error(candidates.length > 0 ? `Ambiguous. Candidates:\n  ${listed}` : `Not found. Sources:\n  ${listed}`);
    process.exit(1);
  }
}

if (theme !== PLAIN && !THEMES.has(theme)) {
  console.error(`Unknown theme. Choose: ${PLAIN}, ${[...THEMES.keys()].join(", ")}`);
  process.exit(1);
}

const source = must(found);
const width = columns !== undefined ? Number(columns) : (process.stdout.columns ?? 80);
console.log(theme === PLAIN ? render(source, { width }) : renderThemed(source, { width }, theme));
