import { withoutAccessible } from "../@common/accessible.js";
import { COMMIT_TYPES, GIT_DIRECTIONS, MAIN_BRANCH, MERGE_TYPE, makeGitGraph, type Commit, type CommitOrigin, type CommitType, type GitGraph } from "./model.js";
import { must, oneOf } from "../../must.js";
import { contentLines, headerBody, headerOf } from "../../source/lines.js";
import { flagOf, type Declared } from "../../source/config.js";
import { LANGIUM_QUOTES, STRING, titleOf, unquoted } from "../@common/langium.js";

const HEADER = "gitGraph";
const HEADER_RE = new RegExp(String.raw`^${HEADER}\s*(?:(${GIT_DIRECTIONS.join("|")})\s*:?|:)?`, "iu");

const COMMIT = "commit";
const BRANCH = "branch ";
const CHECKOUT = "checkout ";
const SWITCH = "switch ";
const MERGE = "merge ";
const CHERRY_PICK = "cherry-pick";
const RESET = "reset ";

const ID_RE = new RegExp(String.raw`id:\s*(${STRING})`, "u");
const TYPE_RE = /type:\s*(NORMAL|REVERSE|HIGHLIGHT)/;
const TAG_RE = new RegExp(String.raw`tag:\s*(${STRING})`, "gu");
const PARENT_RE = new RegExp(String.raw`parent:\s*(${STRING})`, "u");
const BRANCH_RE = new RegExp(String.raw`^branch\s+(?:(${STRING})|([^"'\s]+))\s*(?:order:\s*(\d+))?\s*$`, "u");
const MERGE_RE = new RegExp(String.raw`^merge\s+(?:(${STRING})|(\S+))`, "u");
const NAME_RE = new RegExp(String.raw`^(?:${STRING})$`, "u");
const RESET_RE = /^reset\s+"?([^"~]+?)"?\s*(?:~(\d+))?\s*$/;

const UNORDERED = 0;
const CHERRY_TAG = "cherry-pick:";
const CHERRY_PARENT_TAG = "|parent:";
const DEFAULT_TYPE: CommitType = "NORMAL";

// Every `tag:` of the line in order; an empty one draws nothing, as mermaid.
const tagsOf = (line: string): string[] => [...line.matchAll(TAG_RE)].map((match) => unquoted(match[1])).filter((tag) => tag !== "");

// A name written either as a langium STRING or bare.
const nameOf = (written: string): string => (NAME_RE.test(written) ? unquoted(written) : written);

export function parseGitGraph(text: string, said: Declared = {}): GitGraph {
  return new GitGraphParser(text, said).parse();
}

class GitGraphParser {
  private diagram = makeGitGraph();
  private currentBranch = MAIN_BRANCH;
  private heads = new Map<string, string>();
  // The commits the source named, the last of a name winning as mermaid's map; every one by its key.
  private byId = new Map<string, Commit>();
  private byKey = new Map<string, Commit>();
  private branchNames = new Set<string>();
  private seq = 0;

  constructor(private text: string, private said: Declared) {}

  parse(): GitGraph {
    // `gitGraph.mainBranchName`, the frontmatter's and the init directive's merged as mermaid merges them.
    const named = this.said["mainBranchName"];
    if (named !== undefined) this.diagram.mainBranchName = named;
    this.readFlags();
    // A `%%` closes any statement outside a string, as in mermaid's langium grammar, a directive's line with it.
    const remaining = contentLines(this.text, LANGIUM_QUOTES);
    if (remaining.length === 0) return this.diagram;

    const header = headerOf(remaining[0], HEADER_RE);
    const direction = header?.words[1];
    if (direction !== undefined) this.diagram.direction = must(oneOf(GIT_DIRECTIONS, direction.toUpperCase()));
    // mermaid's grammar reads statements on the header line too: `gitGraph TB: commit`.
    const body = withoutAccessible(header === undefined ? remaining : headerBody(remaining, HEADER_RE));

    this.currentBranch = this.diagram.mainBranchName;
    this.ensureBranch(this.currentBranch, this.diagram.mainBranchOrder);
    for (const line of body) this.parseLine(line);
    return this.diagram;
  }

  private readFlags(): void {
    const git = this.diagram;
    git.showBranches = flagOf(this.said, "showBranches") ?? git.showBranches;
    git.showCommitLabel = flagOf(this.said, "showCommitLabel") ?? git.showCommitLabel;
    git.parallelCommits = flagOf(this.said, "parallelCommits") ?? git.parallelCommits;
    const order = Number.parseFloat(this.said["mainBranchOrder"] ?? "");
    if (!Number.isNaN(order)) git.mainBranchOrder = order;
  }

  private parseLine(line: string): void {
    const title = titleOf(line);
    if (title !== undefined) {
      this.diagram.title = title;
      return;
    }
    if (line.startsWith(COMMIT)) return this.parseCommit(line);
    if (line.startsWith(BRANCH)) return this.parseBranch(line);

    if (line.startsWith(CHECKOUT) || line.startsWith(SWITCH)) {
      const rest = line.slice(line.search(/\s/)).trim();
      if (rest !== "") {
        const name = nameOf(rest);
        if (this.branchNames.has(name)) this.currentBranch = name;
        else this.diagram.warnings.push(`Checkout non-existent branch: ${JSON.stringify(name)}`);
      }
      return;
    }

    if (line.startsWith(MERGE)) return this.parseMerge(line);
    if (line.startsWith(CHERRY_PICK)) return this.parseCherryPick(line);
    if (line.startsWith(RESET)) return this.parseReset(line);

    this.diagram.warnings.push(`Unrecognized line: ${JSON.stringify(line)}`);
  }

  private attributes(line: string): { id: string | undefined; type: CommitType | undefined; tags: string[] } {
    const id = ID_RE.exec(line) ?? undefined;
    const type = TYPE_RE.exec(line) ?? undefined;
    return {
      id: id === undefined ? undefined : unquoted(id[1]),
      type: type === undefined ? undefined : must(oneOf(COMMIT_TYPES, type[1])),
      tags: tagsOf(line),
    };
  }

  // A commit the source leaves unnamed is shown by its place in the source, mermaid's `seq` without the random tail.
  private record(named: string | undefined, type: CommitType, tags: string[], parents: string[], origin: CommitOrigin = "commit"): void {
    const key = String(this.seq);
    const commit: Commit = { key, id: named ?? key, branch: this.currentBranch, type, tags, parents, seq: this.seq, origin, customId: named !== undefined };
    this.seq += 1;
    this.diagram.commits.push(commit);
    this.byKey.set(key, commit);
    if (named !== undefined) this.byId.set(named, commit);
    this.heads.set(this.currentBranch, key);
  }

  private parentsOfHead(): string[] {
    const head = this.heads.get(this.currentBranch);
    return head === undefined ? [] : [head];
  }

  private parseCommit(line: string): void {
    const { id, type, tags } = this.attributes(line);
    this.record(id, type ?? DEFAULT_TYPE, tags, this.parentsOfHead(), "commit");
  }

  private parseBranch(line: string): void {
    const branch = BRANCH_RE.exec(line) ?? undefined;
    if (branch === undefined) return;
    const name = branch[1] === undefined ? branch[2] : unquoted(branch[1]).trim();
    const order = branch[3] === undefined ? UNORDERED : Number.parseInt(branch[3], 10);

    this.ensureBranch(name, order, this.heads.get(this.currentBranch) ?? "");

    const head = this.heads.get(this.currentBranch);
    if (head !== undefined) this.heads.set(name, head);
    this.currentBranch = name;
  }

  private parseMerge(line: string): void {
    const merge = MERGE_RE.exec(line) ?? undefined;
    if (merge === undefined) return;
    const merged = merge[1] === undefined ? merge[2] : unquoted(merge[1]).trim();

    const { id, type, tags } = this.attributes(line);
    const parents = this.parentsOfHead();
    const other = this.heads.get(merged);
    if (other !== undefined) parents.push(other);

    this.record(id, type ?? MERGE_TYPE, tags, parents, "merge");
  }

  private parseCherryPick(line: string): void {
    const source = ID_RE.exec(line) ?? undefined;
    if (source === undefined) return;
    const sourceId = unquoted(source[1]);

    const picked = this.byId.get(sourceId);
    if (picked === undefined) {
      this.diagram.warnings.push(`Cherry-pick non-existent commit: ${JSON.stringify(sourceId)}`);
      return;
    }

    const tags = line.search(TAG_RE) === -1 ? [this.cherryTag(line, sourceId)] : tagsOf(line);
    const parents = this.parentsOfHead();
    parents.push(picked.key);
    this.record(undefined, DEFAULT_TYPE, tags, parents, "cherry-pick");
  }

  // mermaid tags a pick with its source when the source says nothing, the parent too for a merge's.
  private cherryTag(line: string, sourceId: string): string {
    const parent = PARENT_RE.exec(line) ?? undefined;
    const merged = this.byId.get(sourceId)?.origin === "merge";
    return `${CHERRY_TAG}${sourceId}${merged ? `${CHERRY_PARENT_TAG}${parent === undefined ? "" : unquoted(parent[1])}` : ""}`;
  }

  private parseReset(line: string): void {
    const reset = RESET_RE.exec(line) ?? undefined;
    if (reset === undefined) return;
    const ref = reset[1].trim();
    const back = reset[2] === undefined ? 0 : Number.parseInt(reset[2], 10);

    const found = this.heads.get(ref) ?? this.byId.get(ref)?.key;
    if (found === undefined) {
      this.diagram.warnings.push(`Reset to unknown ref: ${JSON.stringify(ref)}`);
      return;
    }
    let key: string = found;

    for (let i = 0; i < back; i++) {
      const parent = this.byKey.get(key)?.parents[0];
      if (parent === undefined) {
        this.diagram.warnings.push(`Cannot walk back ${back} ancestors from ${JSON.stringify(ref)}`);
        return;
      }
      key = parent;
    }

    this.heads.set(this.currentBranch, key);
  }

  private ensureBranch(name: string, order: number = UNORDERED, startCommit = ""): void {
    if (this.branchNames.has(name)) return;
    this.branchNames.add(name);
    this.diagram.branches.push({ name, order, startCommit });
  }
}
