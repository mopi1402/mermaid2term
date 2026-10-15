import type { GitGraph } from "./model.js";

// mermaid sorts on `order` alone, the trunk on `mainBranchOrder` and a branch without one on 0, ties kept in the
// order the branches were made (`getBranchesAsObjArray`, 11.17.0).
export const sortedBranches = (diagram: GitGraph): string[] =>
  diagram.branches
    .map((branch, i) => ({ key: branch.name === diagram.mainBranchName ? diagram.mainBranchOrder : branch.order, i, name: branch.name }))
    .sort((a, b) => a.key - b.key || a.i - b.i)
    .map(({ name }) => name);
