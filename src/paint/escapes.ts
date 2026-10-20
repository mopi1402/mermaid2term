import type { RGB } from "../colour/rgb.js";
import { must } from "../must.js";
import { withoutControls } from "../text/chars.js";

export const ESC = "\x1b";
export const BEL = "\x07";
export const CSI = `${ESC}[`;
export const OSC = `${ESC}]`;
const ST = `${ESC}\\`;

const SGR_END = "m";
export const CODE_SEPARATOR = ";";

export const sgr = (...codes: readonly string[]): string => `${CSI}${codes.join(CODE_SEPARATOR)}${SGR_END}`;

// A fixed BIT order, the index being the bit: reordering changes the codes every style comes out as.
export const SGR_ATTRIBUTES: ReadonlyArray<readonly [name: string, code: string]> = [
  ["bold", "1"],
  ["dim", "2"],
  ["italic", "3"],
  ["underline", "4"],
  ["blink", "5"],
  ["blink2", "6"],
  ["reverse", "7"],
  ["conceal", "8"],
  ["strike", "9"],
  ["underline2", "21"],
  ["frame", "51"],
  ["encircle", "52"],
  ["overline", "53"],
];

const attributeCode = (name: string): string => must(SGR_ATTRIBUTES.find(([known]) => known === name), name)[1];

export const RESET = sgr("0");
export const BOLD = sgr(attributeCode("bold"));
export const DIM = sgr(attributeCode("dim"));

export const STANDARD_FOREGROUND = 30;
export const STANDARD_BACKGROUND = 40;
export const BRIGHT_FOREGROUND = 90;
export const BRIGHT_BACKGROUND = 100;

const TRUECOLOR_FOREGROUND = "38";
const TRUECOLOR_BACKGROUND = "48";
const TRUECOLOR_FORMAT = "2";

export const truecolorCodes = (rgb: RGB, foreground: boolean): string[] => [
  foreground ? TRUECOLOR_FOREGROUND : TRUECOLOR_BACKGROUND,
  TRUECOLOR_FORMAT,
  String(rgb.r),
  String(rgb.g),
  String(rgb.b),
];

const HYPERLINK = `${OSC}8;;`;
export const hyperlinkOpen = (url: string): string => `${HYPERLINK}${withoutControls(url)}${ST}`;
export const HYPERLINK_CLOSE = `${HYPERLINK}${ST}`;

const asPattern = (text: string): string => text.replace(/[\\^$.*+?()[\]{}|]/gu, "\\$&");

// The terminal's background colour, asked with OSC 11 and answered in kind, closed by BEL or ST.
const BACKGROUND_COLOUR = "11;";
export const OSC11_QUERY = `${OSC}${BACKGROUND_COLOUR}?${ST}`;
export const OSC11_REPLY_RE = new RegExp(`${asPattern(OSC + BACKGROUND_COLOUR)}([^${BEL}${ESC}]*)(?:${BEL}|${asPattern(ST)})`, "u");
