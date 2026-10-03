import { queryTerminalBackground } from "./terminal.js";
import { groundFromEnvironment } from "../paint/environment.js";
import type { Args } from "./args.js";

const MERMAID_DEFAULT_THEME = "default";  // keyword: mermaid's own word here, not a style key
export const themeChosen = (args: Args): string => args.theme ?? MERMAID_DEFAULT_THEME;

export async function groundAsked(args: Args): Promise<string | undefined> {
  if (args.background !== undefined) return args.background;
  if (process.stdout.isTTY === true) {
    const answered = await queryTerminalBackground();
    if (answered !== undefined) return answered;
  }
  return groundFromEnvironment(process.env);
}
