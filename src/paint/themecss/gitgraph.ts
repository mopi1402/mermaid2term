import {
  GIT_BRANCH_PREFIX, GIT_CHERRY_BULLET, GIT_CHERRY_CAP, GIT_CHERRY_PICK, GIT_COMMIT_LABEL, GIT_COMMIT_PREFIX, GIT_HIGHLIGHT_PREFIX, GIT_LINE_PREFIX,
  GIT_SPINE, GIT_TAG, GIT_TAG_RIM, LABEL, indexAfter as seatOf,
} from "../../canvas/keys.js";
import { GIT_SEAT_NAMES } from "../theme-model.js";
import { type FillReach, type KindSelector } from "./model.js";

const on = (prefix: string) => (key: string): boolean => seatOf(key, prefix) !== undefined;
const one = (...keys: string[]) => (key: string): boolean => keys.includes(key);

// `.commitN` and its kin, N the branch's seat modulo mermaid's eight colours, as the classic themes number it.
const seated = (name: string, prefix: string, fill: FillReach): KindSelector[] =>
  GIT_SEAT_NAMES.map((_, n) => ({ selectors: [`.${name}${n}`], keys: (key) => (seatOf(key, prefix) ?? -1) % GIT_SEAT_NAMES.length === n, fill }));

const commit = (key: string): boolean => on(GIT_COMMIT_PREFIX)(key) || on(GIT_HIGHLIGHT_PREFIX)(key) || one(GIT_CHERRY_BULLET, GIT_CHERRY_CAP)(key);

// Measured on mermaid 12.0.0 headless: every selector below reaches its element past mermaid's own sheet. `.commit`
// fills every bullet, the cherry-pick's disc and fruit alike, `.branch` and `.arrow` are lines their `stroke` inks.
export const GITGRAPH_SELECTORS: readonly KindSelector[] = [
  { selectors: [".commit"], keys: commit, fill: "ink" },
  { selectors: [".commit", ".commit-cherry-pick"], keys: one(GIT_CHERRY_PICK), fill: "ink" },
  { selectors: [".commit", ".commit-cherry-pick"], keys: one(GIT_CHERRY_PICK), fill: "ground" },
  { selectors: [".commit-cherry-pick"], keys: one(GIT_CHERRY_BULLET, GIT_CHERRY_CAP), fill: "ink" },
  ...seated("commit", GIT_COMMIT_PREFIX, "ink"),
  ...seated("commit-highlight", GIT_HIGHLIGHT_PREFIX, "ink"),
  { selectors: [".commit-label"], keys: one(GIT_COMMIT_LABEL), fill: "ink" },
  { selectors: [".commit-label-bkg"], keys: one(GIT_COMMIT_LABEL), fill: "ground" },
  { selectors: [".branch"], keys: one(GIT_SPINE), fill: "none" },
  { selectors: [".arrow"], keys: on(GIT_LINE_PREFIX), fill: "none" },
  ...seated("arrow", GIT_LINE_PREFIX, "none"),
  ...seated("branch-label", GIT_BRANCH_PREFIX, "ink"),
  ...seated("label", GIT_BRANCH_PREFIX, "ground"),
  { selectors: [".tag-label"], keys: one(GIT_TAG), fill: "ink" },
  { selectors: [".tag-label-bkg"], keys: one(GIT_TAG, GIT_TAG_RIM), fill: "ground" },
  { selectors: [".gitTitleText"], keys: one(LABEL), fill: "ink" },
];
