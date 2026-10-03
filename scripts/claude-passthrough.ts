import {
  BEL,
  BOLD,
  BRIGHT_FOREGROUND,
  CSI,
  ESC,
  HYPERLINK_CLOSE,
  OSC,
  RESET,
  STANDARD_FOREGROUND,
  hyperlinkOpen,
  sgr,
  truecolorCodes,
} from "../src/paint/escapes.js";
import { NEWLINE } from "../src/text/chars.js";

const rgb = (r: number, g: number, b: number): string[] => truecolorCodes({ r, g, b }, true);
const bgRgb = (r: number, g: number, b: number): string[] => truecolorCodes({ r, g, b }, false);
const title = (text: string): void => console.log(`${NEWLINE}${BOLD}${text}${RESET}${NEWLINE}`);
const row = (label: string, text: string): void => console.log(`${label.padEnd(22)} ${text}${RESET}`);
const underline = (style: number): string => `${CSI}4:${style}m`;

const SAMPLE = "Sample ─┬─⏵ text";
const CHARM = "https://charm.land";

title("1. Underline styles (lipgloss UnderlineStyle)");
row("single 4", `${sgr("4")}${SAMPLE}`);
row("single 4:1", `${underline(1)}${SAMPLE}`);
row("double 4:2", `${underline(2)}${SAMPLE}`);
row("curly 4:3", `${underline(3)}${SAMPLE}`);
row("dotted 4:4", `${underline(4)}${SAMPLE}`);
row("dashed 4:5", `${underline(5)}${SAMPLE}`);
row("double 21", `${sgr("21")}${SAMPLE}`);
row("underline red 58", `${sgr("4")}${sgr("58", "2", "255", "60", "60")}${SAMPLE}`);
row("curly red", `${underline(3)}${sgr("58", "2", "255", "60", "60")}${SAMPLE}`);

title("2. Hyperlink (OSC 8, lipgloss Hyperlink)");
row("link ST", `${hyperlinkOpen(CHARM)}Visit Charm${HYPERLINK_CLOSE}`);
row("link BEL", `${OSC}8;;${CHARM}${BEL}Visit Charm${OSC}8;;${BEL}`);
row("link + colour", `${hyperlinkOpen(CHARM)}${sgr(...rgb(123, 47, 190))}Visit Charm${RESET}${HYPERLINK_CLOSE}`);

title("3. Colour depth");
let line16 = "";
for (let c = 0; c < 8; c++) line16 += `${sgr(String(STANDARD_FOREGROUND + c))}██`;
for (let c = 0; c < 8; c++) line16 += `${sgr(String(BRIGHT_FOREGROUND + c))}██`;
row("16 colours", line16);
let line256 = "";
for (let c = 16; c < 52; c++) line256 += `${sgr("38", "5", String(c))}█`;
row("256 colours", line256);
let lineTrue = "";
for (let i = 0; i < 36; i++) lineTrue += `${sgr(...rgb(255 - i * 7, Math.round(i * 4), i * 7))}█`;
row("truecolor gradient", lineTrue);
let lineBg = "";
for (let i = 0; i < 36; i++) lineBg += `${sgr(...bgRgb(20 + i * 6, 0, 120 - i * 3))} `;
row("background gradient", lineBg);

title("4. Weights on colours (lipgloss Faint/Bold/Italic)");
const ORANGE = rgb(255, 140, 0);
row("orange", `${sgr(...ORANGE)}${SAMPLE}`);
row("faint orange", `${sgr("2", ...ORANGE)}${SAMPLE}`);
row("bold orange", `${sgr("1", ...ORANGE)}${SAMPLE}`);
row("bold faint orange", `${sgr("1", "2", ...ORANGE)}${SAMPLE}`);
row("italic faint", `${sgr("3", "2", ...ORANGE)}${SAMPLE}`);
row("faint on purple", `${sgr(...bgRgb(128, 0, 128), "2", ...ORANGE)}${SAMPLE}`);
row("reverse orange", `${sgr("7", ...ORANGE)}${SAMPLE}`);
row("strike orange", `${sgr("9", ...ORANGE)}${SAMPLE}`);
row("overline 53", `${sgr("53", ...ORANGE)}${SAMPLE}`);

title("5. A framed box with a gradient border (lipgloss BorderForegroundBlend)");
const W = 30;
const stops: ReadonlyArray<readonly [number, number, number]> = [
  [255, 0, 0],
  [0, 0, 255],
];
const at = (t: number): string[] => {
  const [from, to] = stops;
  const channel = (k: 0 | 1 | 2): number => Math.round(from[k] + (to[k] - from[k]) * t);
  return rgb(channel(0), channel(1), channel(2));
};
let top = "";
let bottom = "";
for (let i = 0; i < W; i++) {
  top += `${sgr(...at(i / (W - 1)))}${i === 0 ? "╭" : i === W - 1 ? "╮" : "─"}`;
  bottom += `${sgr(...at(i / (W - 1)))}${i === 0 ? "╰" : i === W - 1 ? "╯" : "─"}`;
}
const inner = " Gradient border ".padEnd(W - 2);
console.log(top + RESET);
console.log(`${sgr(...at(0))}│${RESET}${BOLD}${inner}${RESET}${sgr(...at(1))}│${RESET}`);
console.log(bottom + RESET);

title("6. Wide cells and the grid");
row("emoji", "A 🚀 B ⚠️ C 👍🏽 D │end");
row("CJK", "A 寽対寿 B │end");
row("plain ruler", "A ─────── B ────── C │end");

title("7. Cursor and screen controls (should be neutralised by a host)");
row("cursor forward 5", `[${CSI}5C]`);
row("erase line", `visible${CSI}K`);
row("save/restore", `${ESC}7A${ESC}8B`);
console.log();
