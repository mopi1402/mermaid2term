import { centredAt, displayWidth, truncateToWidth } from "../../text/width.js";
import { SPACE } from "../../text/chars.js";
import { BORDER, LABEL_AIR, MIN_LABEL } from "./metrics.js";
import { labelSeat, type Span } from "./labels.js";
import type { Row, Seated } from "./bars.js";
import type { Scale } from "./scale.js";

export type Laid = ReadonlyArray<readonly [number, string]>;

// Where a name goes: its rows of laid characters, on the bar's ground or beside it on the page.
interface NamePlan {
  readonly rows: readonly Laid[];
  readonly inside: boolean;
}

interface LinePlan {
  readonly ordered: readonly Seated[];
  readonly names: ReadonlyArray<NamePlan | undefined>;
  readonly height: number;
}

// A milestone whose name has no room beside it, written under the dates like a `vert` marker's.
export interface Under {
  readonly ordinal: number;
  readonly seat: Seated;
}

export interface Plan {
  readonly lines: readonly LinePlan[];
  readonly unders: readonly Under[];
}

// A name never takes more than two rows: the second is cut where the two still do not hold it.
const MAX_NAME_ROWS = 2;

// Where each character of a name falls from `at`, stepping over every column a marker runs down.
function laidAround(text: string, at: number, cuts: ReadonlySet<number>): Laid {
  const laid: Array<readonly [number, string]> = [];
  let col = at;
  for (const ch of text) {
    const width = displayWidth(ch);
    while (cuts.has(col) || (width > 1 && cuts.has(col + 1))) col += 1;
    laid.push([col, ch]);
    col += width;
  }
  return laid;
}

export const endOf = (laid: Laid): number => {
  const last = laid[laid.length - 1];
  return last === undefined ? -1 : last[0] + displayWidth(last[1]) - 1;
};

// The name laid from `at`, or back as far as it must to stay in its room around the marker columns: the room never
// grows. `undefined` where the whole name does not hold.
function fitted(text: string, at: number, room: Span, cuts: ReadonlySet<number>): Laid | undefined {
  for (let start = at; start >= room[0]; start--) {
    const laid = laidAround(text, start, cuts);
    if (endOf(laid) <= room[1]) return laid;
  }
  return undefined;
}

// The name cut one cell shorter at a time until it holds its room, the line never giving way to a letter.
function shortened(text: string, at: number, room: Span, cuts: ReadonlySet<number>): Laid {
  for (let width = displayWidth(text); width > 0; width--) {
    const laid = fitted(truncateToWidth(text, width), at, room, cuts);
    if (laid !== undefined) return laid;
  }
  return [];
}

// The name on two rows inside its bar, broken between words: as many words on the first as it holds, the rest on
// the second, cut there if they still do not hold, unless `whole` asks for every letter.
function wrapped(title: string, seat: Seated, cuts: ReadonlySet<number>, whole: boolean): NamePlan | undefined {
  const inside = seat.to - seat.from + 1 - 2 * BORDER;
  const room: Span = [seat.from + BORDER, seat.to - BORDER];
  const words = title.split(SPACE).filter((word) => word !== "");
  if (words.length < MAX_NAME_ROWS || inside < MIN_LABEL) return undefined;
  const centred = (text: string): number => seat.from + BORDER + centredAt(inside, text);
  for (let taken = words.length - 1; taken > 0; taken--) {
    const first = words.slice(0, taken).join(SPACE);
    const top = fitted(first, centred(first), room, cuts);
    if (top === undefined) continue;
    const rest = words.slice(taken).join(SPACE);
    const held = fitted(rest, centred(rest), room, cuts);
    if (held === undefined && whole) continue;
    const bottom = held ?? shortened(rest, centred(truncateToWidth(rest, inside)), room, cuts);
    return { rows: [top, bottom], inside: true };
  }
  return undefined;
}

function planSeat(seat: Seated, i: number, ordered: readonly Seated[], scale: Scale, cuts: ReadonlySet<number>): NamePlan | "under" | undefined {
  const [title, , , style] = seat.bar;
  // A milestone's name is always written under the dates, hung from its mark: read apart from the bars around it.
  if (style === "milestone") return "under";
  const prev = ordered[i - 1];
  const next = ordered[i + 1];
  const left: Span = [prev === undefined ? scale.marginLeft + 1 : prev.to + 1 + LABEL_AIR, seat.from - 1 - LABEL_AIR];
  const right: Span = [seat.to + 1 + LABEL_AIR, next === undefined ? scale.marginLeft + scale.chartWidth - 1 : next.from - 1 - LABEL_AIR];
  const seated = labelSeat(title, seat.from, seat.to, left, right, false);
  const room = (inside: boolean, at: number): Span => (inside ? [seat.from + BORDER, seat.to - BORDER] : at > seat.to ? right : left);
  const whole = seated !== undefined && seated.text === title ? fitted(title, seated.at, room(seated.inside, seated.at), cuts) : undefined;
  if (whole !== undefined && seated?.inside === true) return { rows: [whole], inside: true };
  // A name its bar holds whole over two rows stays in the bar rather than going out beside it.
  const two = wrapped(title, seat, cuts, true);
  if (two !== undefined) return two;
  if (whole !== undefined) return { rows: [whole], inside: false };
  const cut = wrapped(title, seat, cuts, false);
  if (cut !== undefined) return cut;
  if (seated === undefined) return undefined;
  return { rows: [shortened(seated.text, seated.at, room(seated.inside, seated.at), cuts)], inside: seated.inside };
}

function planLines(lines: readonly Row[], scale: Scale, cutsAt: (ordinal: number) => ReadonlySet<number>, forced: ReadonlySet<Seated>): Plan {
  const planned: LinePlan[] = [];
  const unders: Under[] = [];
  lines.forEach((line, ordinal) => {
    const ordered = [...line.seats].sort((a, b) => a.from - b.from);
    const cuts = cutsAt(ordinal);
    const names = ordered.map((seat, i) => {
      const plan = forced.has(seat) ? "under" : planSeat(seat, i, ordered, scale, cuts);
      if (plan !== "under") return plan;
      unders.push({ ordinal, seat });
      return undefined;
    });
    const height = Math.max(1, ...names.map((name) => name?.rows.length ?? 1));
    planned.push({ ordered, names, height });
  });
  return { lines: planned, unders };
}

// Every compact line's names, in the order the lines are drawn. A milestone written under the dates runs its line
// down from its mark, so the names on the lines below it step over that column too.
export function planNames(lines: readonly Row[], scale: Scale, markers: ReadonlySet<number>): Plan {
  const first = planLines(lines, scale, () => markers, new Set());
  if (first.unders.length === 0) return first;
  const cutsAt = (ordinal: number): ReadonlySet<number> =>
    new Set([...markers, ...first.unders.filter((under) => under.ordinal < ordinal).map((under) => under.seat.from)]);
  return planLines(lines, scale, cutsAt, new Set(first.unders.map((under) => under.seat)));
}
