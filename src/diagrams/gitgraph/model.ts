export const COMMIT_TYPES = ["NORMAL", "REVERSE", "HIGHLIGHT"] as const;
// A merge no `type:` overrides wears mermaid's own MERGE symbol, a type no source can write.
export const MERGE_TYPE = "MERGE";
export type CommitType = (typeof COMMIT_TYPES)[number] | typeof MERGE_TYPE;

export const GIT_DIRECTIONS = ["LR", "TB", "BT"] as const;
type GitDirection = (typeof GIT_DIRECTIONS)[number];

export const MAIN_BRANCH = "main";

export type CommitOrigin = "commit" | "merge" | "cherry-pick";

export interface Commit {
  // The commit's own, unique whatever the source writes: what parents and every drawing find it by.
  key: string;
  // What the source calls it, or its place in the source where it says nothing; two may share one.
  id: string;
  branch: string;
  type: CommitType;
  tags: string[];
  // The keys of its parents.
  parents: string[];
  seq: number;
  origin: CommitOrigin;
  // Whether the source named the id; mermaid writes a merge's label only then.
  customId: boolean;
}

interface Branch {
  name: string;
  order: number;
  startCommit: string;
}

export interface GitGraph {
  commits: Commit[];
  branches: Branch[];
  direction: GitDirection;
  mainBranchName: string;
  mainBranchOrder: number;
  title: string;
  showBranches: boolean;
  showCommitLabel: boolean;
  parallelCommits: boolean;
  warnings: string[];
}

export const makeGitGraph = (): GitGraph => ({
  commits: [],
  branches: [],
  direction: "LR",
  mainBranchName: MAIN_BRANCH,
  mainBranchOrder: 0,
  title: "",
  showBranches: true,
  showCommitLabel: true,
  parallelCommits: false,
  warnings: [],
});
