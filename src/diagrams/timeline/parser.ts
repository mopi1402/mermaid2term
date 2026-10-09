import {
  makeTimeline,
  makeTimelineEvent,
  makeTimelineSection,
  type Timeline,
  type TimelineEvent,
  type TimelineSection,
  TIMELINE_DIRECTIONS,
} from "./model.js";
import { commented, statementOf } from "./statement.js";
import { withoutAccessible } from "../@common/accessible.js";
import { kept, splitLines } from "../../text/format.js";
import { flagOf, type Declared } from "../../source/config.js";
import { must, oneOf } from "../../must.js";
import { SECTION_WORD, TITLE_WORD, headerBody, headerOf, keywordRest } from "../../source/lines.js";
import { openedIn } from "../@common/sections.js";

const DETAILS = " : ";
const HEADER_RE = /^timeline\b(?:[ \t]+(LR|TD)\b)?/iu;

const detailsOf = kept;

// A line mermaid throws on still draws, cut on its first ` : ` as the neutral period it most looks like.
function fallback(line: string): TimelineEvent {
  const at = line.indexOf(DETAILS);
  if (at < 0) return makeTimelineEvent(line);
  return makeTimelineEvent(line.slice(0, at).trim(), detailsOf([line.slice(at + DETAILS.length)]));
}

export function parseTimeline(text: string, said: Declared = {}): Timeline {
  const lines = splitLines(text).map((line) => line.trim()).filter((line) => line !== "" && !commented(line));
  const timeline = makeTimeline();
  timeline.multicolor = flagOf(said, "disableMulticolor") !== true;
  if (lines.length === 0) return timeline;

  const declared = headerOf(lines[0], HEADER_RE)?.words[1];
  if (declared !== undefined) timeline.direction = must(oneOf(TIMELINE_DIRECTIONS, declared.toUpperCase()));

  let section: TimelineSection | undefined;
  let last: TimelineEvent | undefined;

  // mermaid's lexer reads on past the keyword, so a statement may share the header's line.
  for (const line of withoutAccessible(headerBody(lines, HEADER_RE))) {
    const title = keywordRest(line, TITLE_WORD);
    if (title !== undefined) {
      timeline.title = title.trim();
      continue;
    }

    const named = keywordRest(line, SECTION_WORD);
    if (named !== undefined) {
      section = makeTimelineSection(named.trim());
      timeline.sections.push(section);
      continue;
    }

    const statement = statementOf(line);
    // mermaid's `addEvent` joins a loose `: event` to the last period written, whatever section came since.
    if (statement !== undefined && statement.period === undefined && last !== undefined) {
      last.details.push(...detailsOf(statement.events));
      continue;
    }

    section = openedIn(timeline.sections, section, () => makeTimelineSection(""));
    last =
      statement === undefined || statement.period === undefined
        ? fallback(line)
        : makeTimelineEvent(statement.period, detailsOf(statement.events));
    section.events.push(last);
  }

  return timeline;
}
