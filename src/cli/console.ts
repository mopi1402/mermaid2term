import { type Text } from "../paint/text.js";
import { CONSOLE_WIDTH } from "../paint/ansi.js";
import type { Args } from "./args.js";

export const plainOf = (result: string | Text): string => (typeof result === "string" ? result : result.plain);

// `COLUMNS` as the shell exports it, a count of columns or nothing.
function declaredColumns(): number | undefined {
  const declared = process.env["COLUMNS"];
  return declared !== undefined && /^\d+$/.test(declared) ? Number.parseInt(declared, 10) : undefined;
}

function terminalWidth(): number {
  return declaredColumns() ?? process.stdout.columns ?? CONSOLE_WIDTH;
}

export function consoleWidth(): number {
  const declared = declaredColumns();
  if (declared !== undefined) return declared;
  for (const stream of [process.stdin, process.stdout, process.stderr] as const) {
    const columns = "columns" in stream ? stream.columns : undefined;
    if (columns !== undefined && columns > 0) return columns;
  }
  return CONSOLE_WIDTH;
}

export function targetWidth(args: Args): number | undefined {
  if (args.width !== undefined) return args.width;
  if (args.noAutoFit || process.stdout.isTTY !== true) return undefined;
  return terminalWidth();
}

const TURNABLE = "flowchart";

// Only a flowchart can be turned by its header, so only it is offered a vertical layout.
export const TOO_WIDE = (actual: number, target: number, kind: string | undefined): string =>
  `Warning: diagram is ${actual} cols wide but target is ${target}. ` +
  (kind === TURNABLE ? `Try: less -S, or use 'graph TD' for vertical layout.` : `Try: less -S.`);

const DUMB_TERMS: ReadonlySet<string> = new Set(["dumb", "unknown"]);
const NO_COLOR_VAR = "NO_COLOR";
const FORCE_COLOR_VAR = "FORCE_COLOR";
const TERM_VAR = "TERM";

function consoleShowsColor(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env[NO_COLOR_VAR] !== undefined) return false;
  if (DUMB_TERMS.has(env[TERM_VAR] ?? "")) return false;
  const forced = env[FORCE_COLOR_VAR];
  if (forced !== undefined && forced !== "") return true;
  return process.stdout.isTTY === true;
}

export const useColor = (): boolean => consoleShowsColor();
