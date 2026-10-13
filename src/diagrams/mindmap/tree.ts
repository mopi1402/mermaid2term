import { type CharSet } from "../../canvas/model.js";
import { SPACE } from "../../text/chars.js";
import { displayWidth } from "../../text/width.js";
import { chipWidth } from "../../canvas/chip.js";
import { chipRows, labelRows, rowWidth, run, type Row } from "./label.js";
import { type Branch, branchesOf, edgeKey, nodeKey } from "./sections.js";

// The guides a label's later rows hang from, one column short: the chip's own blank takes the elbow's place.
const narrowed = (rest: Row): Row => {
  const last = rest[rest.length - 1];
  return last === undefined ? rest : [...rest.slice(0, -1), { ...last, text: last.text.slice(0, -1) }];
};

// The indented tree the `tree` command draws: a node a row under its parent, a guide down each open branch, each
// guide inked for the sibling it leads on to.
export function indentedRows(root: Branch, cs: CharSet, wrap: number, budget: number | undefined): Row[] {
  const rows: Row[] = [];
  const open = `${cs.vertical}${SPACE}${SPACE}`;
  const shut = SPACE.repeat(displayWidth(open));
  const visit = (branch: Branch, lead: Row, rest: Row): void => {
    const room = budget === undefined ? wrap : Math.max(1, Math.min(wrap, budget - rowWidth(lead) - chipWidth("")));
    const label = chipRows(labelRows(branch.node, cs.icons, room), nodeKey(branch));
    label.forEach((row, at) => rows.push([...(at === 0 ? lead : narrowed(rest)), ...row]));
    const children = branchesOf(branch);
    children.forEach((child, at) => {
      const next = children[at + 1];
      const elbow = run(`${next === undefined ? cs.bottomLeft : cs.teeRight}${cs.horizontal}`, edgeKey(child.seat));
      visit(child, [...rest, elbow], [...rest, next === undefined ? run(shut) : run(open, edgeKey(next.seat))]);
    });
  };
  visit(root, [], []);
  return rows;
}
