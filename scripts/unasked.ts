import { COLORFGBG_VAR, TERMINAL_BACKGROUND_VAR, TERMINAL_COLOR_SCHEME_VAR } from "../src/paint/environment.js";

// The variables src/paint/environment.ts reads the terminal's ground from.
export const GROUND_VARS = [TERMINAL_BACKGROUND_VAR, TERMINAL_COLOR_SCHEME_VAR, COLORFGBG_VAR] as const;

export function unaskedGround(): void {
  for (const name of GROUND_VARS) delete process.env[name];
}
