import { BOLD, DIM, RESET, SGR_ATTRIBUTES, STANDARD_FOREGROUND, sgr, truecolorCodes } from "../src/paint/escapes.js";
import { STANDARD_COLORS } from "../src/colour/rgb.js";
import { NEWLINE } from "../src/text/chars.js";

const SAMPLE = "─┬─⏵ Sample text ──⏷── ABC abc 123";
const standard = (name: string): string => sgr(String(STANDARD_FOREGROUND + STANDARD_COLORS.indexOf(name)));
const WHITE = standard("white");
const CYAN = standard("cyan");
const PURPLE_BG = sgr(...truecolorCodes({ r: 128, g: 0, b: 128 }, false));
const ORANGE = sgr(...truecolorCodes({ r: 255, g: 140, b: 0 }, true));

const title = (text: string, aside: string): void => console.log(`${NEWLINE}${BOLD}${text}${RESET}  (${aside})${NEWLINE}`);

title("SGR attributes", "plain reference on the first line");
console.log(`${"plain".padEnd(12)} ${"0".padEnd(4)} ${SAMPLE}`);
for (const [name, code] of SGR_ATTRIBUTES) {
  console.log(`${name.padEnd(12)} ${code.padEnd(4)} ${sgr(code)}${SAMPLE}${RESET}`);
}

title("dim against colours", 'what a theme\'s "dim white" and "dim cyan" become here');
for (const [name, colour] of [
  ["white", WHITE],
  ["cyan", CYAN],
]) {
  console.log(`${name.padEnd(12)} ${colour}${SAMPLE}${RESET}`);
  console.log(`${`dim ${name}`.padEnd(12)} ${DIM}${colour}${SAMPLE}${RESET}`);
  console.log(`${`bold ${name}`.padEnd(12)} ${BOLD}${colour}${SAMPLE}${RESET}`);
}

title("dim over a background", "the background must stay whole under dimmed text");
console.log(`${"plain".padEnd(12)} ${PURPLE_BG}${WHITE}${SAMPLE}${RESET}`);
console.log(`${"dim".padEnd(12)} ${PURPLE_BG}${DIM}${WHITE}${SAMPLE}${RESET}`);
console.log(`${"dim, no fg".padEnd(12)} ${PURPLE_BG}${DIM}${SAMPLE}${RESET}`);

title("dim over truecolor", "does dim also lower a 24-bit ink?");
console.log(`${"orange".padEnd(12)} ${ORANGE}${SAMPLE}${RESET}`);
console.log(`${"dim orange".padEnd(12)} ${DIM}${ORANGE}${SAMPLE}${RESET}`);
console.log();
