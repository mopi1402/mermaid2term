import { type ClassDef, type ClassDiagram, type Layout, type NestPlan, type Relationship } from "./model.js";
import { displayWidth } from "../../text/width.js";
import { widestLabelLine } from "../../text/labels.js";
import { must } from "../../must.js";
import { stepPast } from "../../graph/self-loops.js";
import { boxSize, compartmentsOf } from "./class-box.js";
import { BT, loopRows } from "./metrics.js";

// The self relations of every class holding two or more, in the order they are written.
export function nestedLoops(relationships: readonly Relationship[]): Map<string, Relationship[]> {
  const byBox = new Map<string, Relationship[]>();
  for (const rel of relationships) if (rel.source === rel.target) byBox.set(rel.source, [...(byBox.get(rel.source) ?? []), rel]);
  for (const [name, loops] of byBox) if (loops.length < 2) byBox.delete(name);
  return byBox;
}

const widest = (loops: readonly Relationship[], text: (rel: Relationship) => string): number => Math.max(0, ...loops.map((rel) => displayWidth(text(rel))));

// Two lid exits keep a blank between them, and room for the cardinal written beside each.
const exitsOf = (loops: readonly Relationship[]): number[] => {
  const card = widest(loops, (rel) => rel.sourceCard);
  return loops.map((_, k) => 2 + Math.max(2, card === 0 ? 0 : card + 2) * k);
};

// The cells from the wall to the first loop's turn, a return's cardinal written short of it.
export const nestArm = (loops: readonly Relationship[]): number => Math.max(3, widest(loops, (rel) => rel.targetCard) + 1);

// The columns each loop's turn stands past the first one's.
export const nestReach = (loops: readonly Relationship[]): number[] => {
  let reach = 0;
  return loops.map((rel) => {
    const own = reach;
    reach += stepPast(rel.label);
    return own;
  });
};

// The columns past the wall and the rows past the lid a nest takes, its last label included.
export function nestRoom(loops: readonly Relationship[]): readonly [number, number] {
  const last = must(loops.at(-1));
  const label = last.label === "" ? 0 : widestLabelLine(last.label) + 1;
  return [nestArm(loops) + must(nestReach(loops).at(-1)) + 1 + label, loops.length + 1];
}

// The rows the loops come back on, nearest the lid first, off every rule, a cardinal owning the row after its own.
function returnRows(height: number, rules: readonly number[], loops: readonly Relationship[], floor: boolean): number[] {
  const step = floor ? -1 : 1;
  const inside = (row: number): boolean => row >= 1 && row <= height - 2;
  const rows: number[] = [];
  let next = floor ? height - 2 : 1;
  for (const rel of loops) {
    while (inside(next) && rules.includes(next)) next += step;
    if (!inside(next)) return rows;
    rows.push(next);
    next += step * (rel.targetCard === "" ? 1 : 2);
  }
  return rows;
}

const rulesOf = (cls: ClassDef, hideEmpty: boolean): number[] => compartmentsOf(cls, hideEmpty).map(({ rule }) => rule);

// Every nesting class grows the columns its lid exits need, kept on the loops' half of it, and the wall rows its
// returns need.
export function grownForNests(diagram: ClassDiagram, paddingX: number, hideEmpty: boolean): ClassDiagram {
  const nests = nestedLoops(diagram.relationships);
  if (nests.size === 0) return diagram;
  const floor = diagram.direction === BT;
  const classes = new Map(diagram.classes);
  for (const [name, loops] of nests) {
    const cls = classes.get(name);
    if (cls === undefined || cls.lollipop) continue;
    const [width, height] = boxSize(cls, paddingX, hideEmpty);
    const far = must(exitsOf(loops).at(-1));
    let w = width;
    while (far > Math.ceil(w / 2) - 3) w += 1;
    let h = height;
    while (returnRows(h, rulesOf(cls, hideEmpty), loops, floor).length < loops.length) h += 1;
    classes.set(name, { ...cls, grown: [w - width, h - height] });
  }
  return { ...diagram, classes };
}

export function nestPlans(diagram: ClassDiagram, paddingX: number, hideEmpty: boolean): Map<string, NestPlan> {
  const floor = diagram.direction === BT;
  const plans = new Map<string, NestPlan>();
  for (const [name, loops] of nestedLoops(diagram.relationships)) {
    const cls = diagram.classes.get(name);
    if (cls === undefined || cls.lollipop) continue;
    const returns = returnRows(boxSize(cls, paddingX, hideEmpty)[1], rulesOf(cls, hideEmpty), loops, floor);
    plans.set(name, { loops, floor, returns, exits: exitsOf(loops) });
  }
  return plans;
}

// The rows of its wall a class's self relations take, first and last, where no other relation may meet it.
export function loopSpan(layout: Layout, name: string): readonly [number, number] {
  const [, y] = must(layout.positions.get(name));
  const [, h] = must(layout.sizes.get(name));
  const plan = layout.nests?.get(name);
  if (plan === undefined) return [y, loopRows(y, h)[1]];
  const last = must(plan.loops.at(-1));
  const far = must(plan.returns.at(-1)) + (last.targetCard === "" ? 0 : plan.floor ? -1 : 1);
  return plan.floor ? [y + far, y + h - 1] : [y, y + far];
}

// The rows past its floor, or past its lid, a class's nest rides.
export function nestRows(layout: Layout, name: string, floor: boolean): number {
  const plan = layout.nests?.get(name);
  return plan === undefined || plan.floor !== floor ? 0 : nestRoom(plan.loops)[1];
}
