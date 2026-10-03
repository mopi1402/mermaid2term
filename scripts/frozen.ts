import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderThemed, type Options } from "../src/index.js";
import { CORPORA, WIDTHS, sourcePath, sources } from "./ourtakes.js";
import { unaskedGround } from "./unasked.js";

unaskedGround();

// Every drawing of the corpus, as the screen gets it, frozen as one hash per view: a change anywhere in the renderer
// that moves a drawing it was not meant to move shows here, whichever kind it was made for.
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FROZEN = path.join(ROOT, "fixtures", "frozen.json");
const UPDATE_FLAG = "--update";
const SHOW_FLAG = "--show";
const PART_FLAG = "--part";
const MAX_WORKERS = 10;

interface View {
  readonly name: string;
  readonly draw: (source: string, options: Options) => string;
}

// The three border modes, each under a theme of its own: the neutral one a host asking for no theme draws in, a light
// theme turned for a dark ground, and a dark one turned for a light ground.
const VIEWS: readonly View[] = [
  { name: "mono-light", draw: (source, options) => renderThemed(source, { ...options, background: "light" }, "mono") },
  { name: "default-dark-borderless", draw: (source, options) => renderThemed(source, { ...options, borders: "borderless", background: "dark" }, "default") },
  { name: "dracula-light-padless", draw: (source, options) => renderThemed(source, { ...options, borders: "padless", background: "light" }, "dracula") },
];

interface Take {
  readonly key: string;
  readonly source: string;
  readonly view: View;
  readonly width: number;
}

const takes = (): Take[] =>
  CORPORA.flatMap((corpus) =>
    sources(corpus).flatMap((name) => {
      const file = sourcePath(corpus, name);
      const at = path.relative(ROOT, file);
      return VIEWS.flatMap((view) => WIDTHS.map((width) => ({ key: `${at}|${view.name}|${width}`, source: file, view, width })));
    })
  );

const drawn = (take: Take): string => {
  const source = fs.readFileSync(take.source, "utf8");
  try {
    return take.view.draw(source, { width: take.width });
  } catch (error) {
    return `THROW ${String(error)}`;
  }
};

const hashOf = (text: string): string => createHash("sha1").update(text).digest("hex").slice(0, 16);

// One share of the takes, dealt by index so every worker gets a mix of heavy and light sources.
function part(index: number, count: number): void {
  const out: Record<string, string> = {};
  takes().forEach((take, at) => {
    if (at % count === index) out[take.key] = hashOf(drawn(take));
  });
  process.stdout.write(JSON.stringify(out));
}

function share(index: number, count: number): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [...process.execArgv, fileURLToPath(import.meta.url), PART_FLAG, String(index), String(count)], { stdio: ["ignore", "pipe", "inherit"] });
    let text = "";
    child.stdout.on("data", (chunk: Buffer) => {
      text += chunk.toString();
    });
    child.on("close", (status) => (status === 0 ? resolve(JSON.parse(text)) : reject(new Error(`worker ${index} exited ${status}`))));
  });
}

async function everyHash(): Promise<Record<string, string>> {
  const count = Math.min(MAX_WORKERS, os.availableParallelism());
  const shares = await Promise.all(Array.from({ length: count }, (_, index) => share(index, count)));
  return Object.fromEntries(shares.flatMap((one) => Object.entries(one)).sort(([a], [b]) => (a < b ? -1 : 1)));
}

function readFrozen(): Record<string, string> {
  return fs.existsSync(FROZEN) ? JSON.parse(fs.readFileSync(FROZEN, "utf8")) : {};
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const at = args.indexOf(PART_FLAG);
  if (at !== -1) {
    part(Number(args[at + 1]), Number(args[at + 2]));
    return 0;
  }
  const shown = args.indexOf(SHOW_FLAG);
  if (shown !== -1) {
    const take = takes().find((one) => one.key === args[shown + 1]);
    if (take === undefined) {
      console.log(`no take named ${args[shown + 1]}`);
      return 1;
    }
    process.stdout.write(`${drawn(take)}\n`);
    return 0;
  }

  const hashes = await everyHash();
  if (args.includes(UPDATE_FLAG)) {
    fs.writeFileSync(FROZEN, `${JSON.stringify(hashes, undefined, 1)}\n`);
    console.log(`frozen: ${Object.keys(hashes).length} drawings written`);
    return 0;
  }
  const frozen = readFrozen();
  const moved = Object.keys(hashes).filter((key) => frozen[key] !== hashes[key]);
  const gone = Object.keys(frozen).filter((key) => hashes[key] === undefined);
  if (moved.length === 0 && gone.length === 0) {
    console.log(`frozen: ${Object.keys(hashes).length} drawings, nothing moved`);
    return 0;
  }
  const sourcesMoved = new Set(moved.map((key) => key.split("|")[0]));
  console.log(`frozen: ${moved.length} drawings moved over ${sourcesMoved.size} sources, ${gone.length} gone`);
  for (const key of [...moved, ...gone].slice(0, 40)) console.log(`  ${frozen[key] === undefined ? "new " : hashes[key] === undefined ? "gone" : "moved"} ${key}`);
  if (moved.length + gone.length > 40) console.log(`  … ${moved.length + gone.length - 40} more`);
  console.log(`see one with: tsx scripts/frozen.ts --show '<key>'; refreeze a wanted change with: pnpm frozen:update`);
  return 1;
}

if (import.meta.main) process.exit(await main());
