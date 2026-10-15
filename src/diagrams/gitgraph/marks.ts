import { MERGE_TYPE, type Commit, type CommitType, type GitGraph } from "./model.js";
import type { Canvas } from "../../canvas/canvas.js";
import type { CharSet } from "../../canvas/model.js";
import { GIT_CHERRY_BULLET, GIT_CHERRY_CAP, GIT_CHERRY_PICK, GIT_COMMIT_PREFIX, GIT_HIGHLIGHT_PREFIX, GIT_TAG, GIT_TAG_RIM, indexed } from "../../canvas/keys.js";
import { SPACE } from "../../text/chars.js";
import { displayWidth } from "../../text/width.js";

const markerOfType = (type: CommitType, cs: CharSet): string =>
  type === "REVERSE" ? cs.commitReverse : type === "HIGHLIGHT" ? cs.commitHighlight : type === MERGE_TYPE ? cs.commitMerge : cs.commitNormal;

const markerOf = (commit: Commit, cs: CharSet): string => (commit.origin === "cherry-pick" ? cs.commitCherry : markerOfType(commit.type, cs));

// The cells a mark takes left of its column: a cherry's rounded end.
export const markLead = (commit: Commit, cs: CharSet): number => (commit.origin === "cherry-pick" ? displayWidth(cs.cherryCaps[0]) : 0);

// A mark two cells wide, the cherry, is written as text so its second cell is kept for it.
export function putMarker(canvas: Canvas, row: number, col: number, commit: Commit, cs: CharSet, seat: number): void {
  const mark = markerOf(commit, cs);
  if (displayWidth(mark) > 1) canvas.putText(row, col, mark, markerKey(commit, seat));
  else canvas.put(row, col, mark, false, commit.origin === "cherry-pick" ? GIT_CHERRY_BULLET : markerKey(commit, seat));
  if (commit.origin !== "cherry-pick") return;
  // The cherry's white ground closes on a rounded end each side, over the line it stands on.
  const [left, right] = cs.cherryCaps;
  if (left !== "") canvas.put(row, col - markLead(commit, cs), left, false, GIT_CHERRY_CAP);
  if (right !== "") canvas.put(row, col + displayWidth(mark), right, false, GIT_CHERRY_CAP);
}

// `drawCommitBullet`: a cherry-pick carries no `commit{i}` class, a highlight takes `commit-highlight{i}` for its
// outer square, every other bullet `commit{i}`, merges and reverts included.
const markerKey = (commit: Commit, seat: number): string =>
  commit.origin === "cherry-pick"
    ? GIT_CHERRY_PICK
    : indexed(commit.type === "HIGHLIGHT" ? GIT_HIGHLIGHT_PREFIX : GIT_COMMIT_PREFIX, seat);

const OPEN = "[";
const CLOSE = "]";

// A tag's name opens on the charset's tag icon, a space apart, where it has one.
const nameOf = (tag: string, cs: CharSet): string => (cs.tagIcon === "" ? tag : `${cs.tagIcon}${SPACE}${tag}`);

const tagText = (tag: string, cs: CharSet): string => `${OPEN}${nameOf(tag, cs)}${CLOSE}`;
export const tagsText = (tags: readonly string[], cs: CharSet): string => tags.map((tag) => tagText(tag, cs)).join(SPACE);

// Each tag's brackets stand for `.tag-label-bkg`'s outline, its name for `.tag-label`.
export function putTags(canvas: Canvas, row: number, col: number, tags: readonly string[], cs: CharSet): void {
  let at = col;
  tags.forEach((tag, i) => {
    if (i > 0) at += displayWidth(SPACE);
    const name = nameOf(tag, cs);
    canvas.putText(row, at, OPEN, GIT_TAG_RIM);
    canvas.putText(row, at + displayWidth(OPEN), name, GIT_TAG);
    at += displayWidth(OPEN) + displayWidth(name);
    canvas.putText(row, at, CLOSE, GIT_TAG_RIM);
    at += displayWidth(CLOSE);
  });
}

// mermaid writes no label under a cherry-pick, nor under a merge the source did not name (`drawCommitLabel`, 11.17.0).
export const labelOf = (diagram: GitGraph, commit: Commit): string =>
  !diagram.showCommitLabel || commit.origin === "cherry-pick" || (commit.origin === "merge" && !commit.customId) ? "" : commit.id;
