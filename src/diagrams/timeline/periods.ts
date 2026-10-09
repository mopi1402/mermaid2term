import type { Timeline } from "./model.js";
import { WRAP } from "./metrics.js";
import { wordWrap } from "../../text/width.js";
import { indexed, SECTION_PREFIX, TIMELINE_EVENT_PREFIX } from "../../canvas/keys.js";

// mermaid's timeline `wrap` breaks on `<br>` spelled exactly so, and folds each piece inside its fixed node.
const BREAK = "<br>";
// mermaid's node widths in px, read at `WRAP` cells for the 150px node its across renderer folds in.
const ACROSS_NODE_PX = 150;
export const DOWN_PERIOD_PX = 200;
export const DOWN_EVENT_PX = 300;
export const DOWN_SECTION_PX = 580;
export const cellsFor = (px: number): number => Math.floor((px * WRAP) / ACROSS_NODE_PX);
export const UNBOUNDED = Number.POSITIVE_INFINITY;

export const sectionFill = (index: number): string => indexed(SECTION_PREFIX, index);
// mermaid draws an event as a box of its section, `.section-N text` its words.
export const eventStyle = (index: number): string => indexed(TIMELINE_EVENT_PREFIX, index);

export const linesOf = (text: string, cap: number): string[] =>
  text.split(BREAK).flatMap((piece) => {
    const bare = piece.trim();
    return wordWrap(bare, cap);
  });

export interface Period {
  readonly title: readonly string[];
  // The events one under the other, a blank row between two of them wherever one event holds several lines.
  readonly details: readonly string[];
  readonly section: number;
  readonly colour: number;
}

// Without a section mermaid steps the colour at every period (`drawTasks`), unless `disableMulticolor` holds it.
export function periodsOf(diagram: Timeline, cap: number, eventCap = cap): Period[] {
  const named = diagram.sections.some((section) => section.title !== "");
  const stepped = !named && diagram.multicolor;
  const folded = diagram.sections.map((section) =>
    section.events.map((event) => ({ title: linesOf(event.title, cap), events: event.details.map((d) => linesOf(d, eventCap)) }))
  );
  const spaced = folded.some((events) => events.some((event) => event.events.some((lines) => lines.length > 1)));
  const periods: Period[] = [];
  folded.forEach((events, si) => {
    for (const event of events) {
      const details = event.events.flatMap((lines, at) => (spaced && at > 0 ? ["", ...lines] : lines));
      periods.push({ title: event.title, details, section: si, colour: stepped ? periods.length : si });
    }
  });
  return periods;
}
