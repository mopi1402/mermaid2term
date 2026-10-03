import { NEWLINE } from "../text/chars.js";

export const PROGRAM = "mermaid2term";
export const OK = 0;
export const FAILED = 1;
export const MISUSED = 2;

export const out = (line: string): void => {
  process.stdout.write(line + NEWLINE);
};
export const err = (line: string): void => {
  process.stderr.write(line + NEWLINE);
};

