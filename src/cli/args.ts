import { JSON_TYPES, type JsonType } from "./ingest.js";
import { BORDER_MODES, CHARSET_NAMES, DEFAULT_CHARSET, THEMES, type BorderMode } from "../index.js";
import { DARK_BACKGROUND, LIGHT_BACKGROUND } from "../colour/background.js";
import { HEX_RE } from "../colour/rgb.js";
import { oneOf } from "../must.js";

const THEME_NAMES = [...THEMES.keys()];

const DEFAULT_PADDING_X = 4;
const DEFAULT_PADDING_Y = 2;
const DEFAULT_GAP = 4;
export const ALL = "all";

export interface Args {
  file: string | undefined;
  charset: string;
  paddingX: number;
  paddingY: number;
  gap: number;
  width: number | undefined;
  height: number | undefined;
  sharpEdges: boolean;
  borders: BorderMode;
  theme: string | undefined;
  background: string | undefined;
  noAutoFit: boolean;
  output: string | undefined;
  showIds: boolean;
  json: JsonType | undefined;
  themes: boolean;
  demo: string | undefined;
  checkBackground: boolean;
}

const DEFAULTS: Args = {
  file: undefined,
  charset: DEFAULT_CHARSET,
  paddingX: DEFAULT_PADDING_X,
  paddingY: DEFAULT_PADDING_Y,
  gap: DEFAULT_GAP,
  width: undefined,
  height: undefined,
  sharpEdges: false,
  borders: "default",
  theme: undefined,
  background: undefined,
  noAutoFit: false,
  output: undefined,
  showIds: false,
  json: undefined,
  themes: false,
  demo: undefined,
  checkBackground: false,
};

interface Shown {
  shown: "help" | "version";
}
export type Parsed = Args | Shown;

export class UsageError extends Error {}

const asInteger = (flag: string, text: string): number => {
  if (!/^[+-]?\d+$/.test(text.trim())) throw new UsageError(`argument ${flag}: invalid int value: '${text}'`);
  return Number.parseInt(text, 10);
};

const asChoice = <T extends string>(flag: string, text: string, choices: readonly T[]): T => {
  const chosen = oneOf(choices, text);
  if (chosen === undefined) {
    throw new UsageError(`argument ${flag}: invalid choice: '${text}' (choose from ${choices.map((c) => `'${c}'`).join(", ")})`);
  }
  return chosen;
};

const asBackground = (flag: string, text: string): string => {
  const said = text.trim().toLowerCase();
  if (said === LIGHT_BACKGROUND || said === DARK_BACKGROUND || HEX_RE.test(said)) return said;
  throw new UsageError(`argument ${flag}: invalid choice: '${text}' (choose from 'light', 'dark', or a #rrggbb colour)`);
};

interface Reader {
  next(flag: string, inline: string | undefined): string;
}

export function parseArgs(argv: readonly string[]): Parsed {
  const args: Args = { ...DEFAULTS };
  let at = 0;
  const reader: Reader = {
    next(flag, inline) {
      if (inline !== undefined) return inline;
      const value = argv[++at];
      if (value === undefined) throw new UsageError(`argument ${flag}: expected one argument`);
      return value;
    },
  };
  const optional = (inline: string | undefined): string | undefined => {
    if (inline !== undefined) return inline;
    const value = argv[at + 1];
    if (value === undefined || value.startsWith("-")) return undefined;
    at++;
    return value;
  };

  for (; at < argv.length; at++) {
    const token = argv[at];
    if (!token.startsWith("-") || token === "-") {
      if (args.file !== undefined) throw new UsageError(`unrecognized arguments: ${token}`);
      args.file = token;
      continue;
    }

    const split = token.indexOf("=");
    const flag = split < 0 ? token : token.slice(0, split);
    const inline = split < 0 ? undefined : token.slice(split + 1);

    switch (flag) {
      case "-h":
      case "--help":
        return { shown: "help" };
      case "--version":
        return { shown: "version" };
      case "--charset":
        args.charset = asChoice(flag, reader.next(flag, inline), CHARSET_NAMES);
        break;
      case "--padding-x":
        args.paddingX = asInteger(flag, reader.next(flag, inline));
        break;
      case "--padding-y":
        args.paddingY = asInteger(flag, reader.next(flag, inline));
        break;
      case "--gap":
        args.gap = asInteger(flag, reader.next(flag, inline));
        break;
      case "--width":
        args.width = asInteger(flag, reader.next(flag, inline));
        break;
      case "--height":
        args.height = asInteger(flag, reader.next(flag, inline));
        break;
      case "--sharp-edges":
        args.sharpEdges = true;
        break;
      case "--borders":
        args.borders = asChoice(flag, reader.next(flag, inline), BORDER_MODES);
        break;
      case "--borderless":
        args.borders = "borderless";
        break;
      case "--theme":
        args.theme = asChoice(flag, reader.next(flag, inline), THEME_NAMES);
        break;
      case "--background":
        args.background = asBackground(flag, reader.next(flag, inline));
        break;
      case "--no-auto-fit":
        args.noAutoFit = true;
        break;
      case "-o":
      case "--output":
        args.output = reader.next(flag, inline);
        break;
      case "--show-ids":
        args.showIds = true;
        break;
      case "--json":
        args.json = asChoice(flag, reader.next(flag, inline), JSON_TYPES);
        break;
      case "--themes":
        args.themes = true;
        break;
      case "--demo":
        args.demo = optional(inline) ?? ALL;
        break;
      case "--check-background":
        args.checkBackground = true;
        break;
      default:
        throw new UsageError(`unrecognized arguments: ${token}`);
    }
  }

  return args;
}
