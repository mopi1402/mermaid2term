import { DEFAULT_SCORE, makeJourney, makeJourneySection, type Journey, type JourneySection } from "./model.js";
import { integerOf, listed } from "../../text/format.js";
import { SECTION_WORD, TITLE_WORD, contentLines, headerBody, keywordRest } from "../../source/lines.js";
import { openedIn } from "../@common/sections.js";
import { withoutAccessible } from "../@common/accessible.js";

const FIELD = ":";
// mermaid's journey lexer opens a comment at any `#`, the rest of the line with it.
const HASH_COMMENT = "#";
const ACTOR_SEPARATOR = ",";
const MIN_SCORE = 1;
const MAX_SCORE = 5;
const HEADER_RE = /^journey\b/u;

export function parseJourney(text: string): Journey {
  const lines = contentLines(text);
  const journey = makeJourney();
  if (lines.length === 0) return journey;

  let section: JourneySection | undefined;
  // mermaid's lexer reads on past the keyword, so a statement may share the header's line.
  for (const line of withoutAccessible(headerBody(lines, HEADER_RE))) {
    const stripped = line.split(HASH_COMMENT)[0].trimEnd();

    const heading = keywordRest(stripped, TITLE_WORD);
    if (heading !== undefined) {
      journey.title = heading.trim();
      continue;
    }

    const named = keywordRest(stripped, SECTION_WORD);
    if (named !== undefined) {
      section = makeJourneySection(named.trim());
      journey.sections.push(section);
      continue;
    }

    if (!stripped.includes(FIELD)) continue;

    const parts = stripped.split(FIELD);
    const title = parts[0].trim();

    const written = parts.length >= 2 ? integerOf(parts[1]) : undefined;
    const score = written === undefined ? DEFAULT_SCORE : Math.max(MIN_SCORE, Math.min(MAX_SCORE, written));

    const actors =
      parts.length >= 3
        ? listed(parts[2], ACTOR_SEPARATOR)
        : [];

    section = openedIn(journey.sections, section, () => makeJourneySection(""));

    section.tasks.push({ title, score, actors });
  }

  // mermaid knows a section only through its tasks, so one with none draws nothing.
  journey.sections = journey.sections.filter((s) => s.tasks.length > 0);
  return journey;
}
