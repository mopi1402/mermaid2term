import { spawnSync } from "node:child_process";
import { createHash, type Hash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// A gate check whose own inputs have not moved since it last passed passes again without running: every oracle is
// deterministic, so the same files give the same verdict. Only a pass is kept, never a failure.
interface Oracle {
  readonly command: readonly string[];
  // Scripts whose import graph, followed file by file, is code the verdict rests on.
  readonly entries?: readonly string[];
  // Whole trees read as they stand, for a check that reads every file under them.
  readonly trees?: readonly string[];
  // Directories whose `.mmd` files, at any depth, and their listing, are the corpus the check draws.
  readonly corpora?: readonly string[];
  readonly files?: readonly string[];
}

const TSC_CACHE = "node_modules/.cache/tsc/tsbuildinfo";
const CORPORA = ["fixtures"];

const ORACLES: Readonly<Record<string, Oracle>> = {
  typecheck: { command: ["tsc", "-p", "tsconfig.json", "--incremental", "--tsBuildInfoFile", TSC_CACHE], trees: ["src", "tests", "scripts"], files: ["vitest.config.ts"] },
  arrows: { command: ["tsx", "scripts/arrows.ts"], entries: ["scripts/arrows.ts"], corpora: CORPORA },
  merges: { command: ["tsx", "scripts/merges.ts"], entries: ["scripts/merges.ts"], corpora: CORPORA },
  strokes: { command: ["tsx", "scripts/strokes.ts"], entries: ["scripts/strokes.ts"], files: ["fixtures/flowchart/stroke-visibility.mmd"] },
  grounds: { command: ["tsx", "scripts/grounds.ts"], entries: ["scripts/grounds.ts"], corpora: CORPORA },
  clones: { command: ["jscpd", "-c", ".jscpd.json", "--baseline", ".jscpd-baseline.json", "--fail-on-new-clones"], trees: ["src"], files: [".jscpd.json", ".jscpd-baseline.json"] },
  deadcode: {
    command: ["knip"],
    trees: ["src", "scripts", "tests", "packages/playground/src", "packages/playground/tests"],
    files: ["knip.json", "pnpm-workspace.yaml", "packages/playground/package.json", "packages/playground/tsconfig.json", "packages/playground/vite.config.ts", "packages/playground/index.html", "packages/playground/components.json"],
  },
  frozen: { command: ["tsx", "scripts/frozen.ts"], entries: ["scripts/frozen.ts"], corpora: CORPORA, files: ["fixtures/frozen.json"] },
};

// What every check rests on: the toolchain, the dependencies, how TypeScript is read, and this file's own rules.
const SHARED_FILES = ["package.json", "pnpm-lock.yaml", "tsconfig.json", "scripts/memo.ts"];
// The variables src/paint/environment.ts reads the terminal's ground from, which a themed drawing depends on, read off
// that file since this one runs under plain node.
const GROUND_VARS = [...readFileSync("src/paint/environment.ts", "utf8").matchAll(/^export const \w+_VAR = "(\w+)";$/gmu)].map(([, name]) => name);
if (GROUND_VARS.length === 0) throw new Error("no ground variable found in src/paint/environment.ts");
const CACHE = "node_modules/.cache/oracles";

const byName = (a: { name: string }, b: { name: string }): number => (a.name < b.name ? -1 : 1);

function hashFile(hash: Hash, file: string): void {
  hash.update(file).update(existsSync(file) ? readFileSync(file) : "missing");
}

function hashTree(hash: Hash, dir: string): void {
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort(byName)) {
    const at = `${dir}/${entry.name}`;
    if (entry.isDirectory()) hashTree(hash, at);
    else hashFile(hash, at);
  }
}

function hashSources(hash: Hash, dir: string): void {
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort(byName)) {
    const at = `${dir}/${entry.name}`;
    if (entry.isDirectory()) hashSources(hash, at);
    else if (entry.name.endsWith(".mmd")) hashFile(hash, at);
  }
}

// Every relative specifier a file names, found by pattern rather than parsed: a line the pattern reads too widely
// only adds a file to the key, never drops one.
const SPECIFIER_RE = /(?:\bfrom|\bimport|\bimport\s*\()\s*["'](\.{1,2}\/[^"']+)["']/gu;
const TS_OF_JS_RE = /\.js$/u;

function importGraph(entries: readonly string[]): string[] {
  const seen = new Set<string>();
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.pop() ?? "";
    if (seen.has(file)) continue;
    seen.add(file);
    if (!existsSync(file)) continue;
    for (const [, specifier] of readFileSync(file, "utf8").matchAll(SPECIFIER_RE)) {
      const named = path.relative(".", path.resolve(path.dirname(file), specifier));
      const typed = named.replace(TS_OF_JS_RE, ".ts");
      queue.push(existsSync(typed) ? typed : named);
    }
  }
  return [...seen].sort();
}

function inputsKey(oracle: Oracle): string {
  const hash = createHash("sha1").update(process.version).update(oracle.command.join(" "));
  for (const file of SHARED_FILES) hashFile(hash, file);
  for (const name of GROUND_VARS) hash.update(`${name}=${process.env[name] ?? ""}`);
  for (const file of importGraph(oracle.entries ?? [])) hashFile(hash, file);
  for (const dir of oracle.trees ?? []) hashTree(hash, dir);
  for (const dir of oracle.corpora ?? []) hashSources(hash, dir);
  for (const file of oracle.files ?? []) hashFile(hash, file);
  return hash.digest("hex");
}

function oracleOf(name: string): Oracle {
  const oracle = ORACLES[name];
  if (oracle === undefined) throw new Error(`no oracle named ${name}: ${Object.keys(ORACLES).join(", ")}`);
  return oracle;
}

const keptKey = (name: string): string | undefined => {
  try {
    return readFileSync(`${CACHE}/${name}`, "utf8");
  } catch {
    return undefined;
  }
};

const keep = (name: string, key: string): void => {
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(`${CACHE}/${name}`, key);
};

// Called by a check that settled another one's verdict in the same pass, when run through this file.
export function remember(name: string): void {
  if (process.env.ORACLE_MEMO === undefined) return;
  keep(name, inputsKey(oracleOf(name)));
}

function main(name: string): number {
  const oracle = oracleOf(name);
  const key = inputsKey(oracle);
  if (keptKey(name) === key) {
    console.log(`${name}: passed on these very inputs, not run again`);
    return 0;
  }
  const [command, ...args] = oracle.command;
  const run = spawnSync(command, args, { stdio: "inherit", env: { ...process.env, ORACLE_MEMO: "1" } });
  const status = run.status ?? 1;
  if (status === 0) keep(name, key);
  return status;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main(process.argv[2] ?? ""));
