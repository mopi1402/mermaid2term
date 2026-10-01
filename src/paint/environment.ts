import { DARK_BACKGROUND, LIGHT_BACKGROUND, type Background } from "../colour/background.js";
import { HEX_RE } from "../colour/rgb.js";
import type { BackgroundOption } from "./ground.js";

export const TERMINAL_BACKGROUND_VAR = "TERMINAL_BACKGROUND";
export const TERMINAL_COLOR_SCHEME_VAR = "TERMINAL_COLOR_SCHEME";
export const COLORFGBG_VAR = "COLORFGBG";

const GROUND_VARS = [TERMINAL_BACKGROUND_VAR, TERMINAL_COLOR_SCHEME_VAR, COLORFGBG_VAR] as const;
export type GroundVar = (typeof GROUND_VARS)[number];

export type Environment = Readonly<Record<string, string | undefined>>;

const DARK_SLOT_LAST = 6;
const DARK_SLOT_GREY = 8;

export function colourFromTerminalBackground(value: string | undefined): string | undefined {
  return value !== undefined && HEX_RE.test(value) ? value : undefined;
}

export function backgroundFromColorScheme(value: string | undefined): Background | undefined {
  const word = value?.trim().toLowerCase();
  if (word === DARK_BACKGROUND) return DARK_BACKGROUND;
  if (word === LIGHT_BACKGROUND) return LIGHT_BACKGROUND;
  return undefined;
}

export function backgroundFromColorFgBg(value: string | undefined): Background | undefined {
  if (value === undefined) return undefined;
  const fields = value.split(";");
  const last = fields[fields.length - 1] ?? "";
  if (!/^\d+$/u.test(last)) return undefined;
  const slot = Number.parseInt(last, 10);
  return slot <= DARK_SLOT_LAST || slot === DARK_SLOT_GREY ? DARK_BACKGROUND : LIGHT_BACKGROUND;
}

export interface EnvironmentGround {
  readonly variable: GroundVar;
  readonly value: BackgroundOption;
}

export function environmentGround(env: Environment): EnvironmentGround | undefined {
  const colour = colourFromTerminalBackground(env[TERMINAL_BACKGROUND_VAR]);
  if (colour !== undefined) return { variable: TERMINAL_BACKGROUND_VAR, value: colour };
  const scheme = backgroundFromColorScheme(env[TERMINAL_COLOR_SCHEME_VAR]);
  if (scheme !== undefined) return { variable: TERMINAL_COLOR_SCHEME_VAR, value: scheme };
  const slot = backgroundFromColorFgBg(env[COLORFGBG_VAR]);
  if (slot !== undefined) return { variable: COLORFGBG_VAR, value: slot };
  return undefined;
}

export const groundFromEnvironment = (env: Environment): BackgroundOption | undefined => environmentGround(env)?.value;

export function hostGround(): BackgroundOption | undefined {
  if (typeof process === "undefined" || typeof process.env !== "object") return undefined;
  return groundFromEnvironment(process.env);
}
