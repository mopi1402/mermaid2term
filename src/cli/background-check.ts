import { DARK_BACKGROUND, sideOf } from "../colour/background.js";
import { groundOf, twinOf, type Ground } from "../paint/ground.js";
import { renderThemedText } from "../index.js";
import { mixRGB } from "../colour/palette.js";
import { BLACK_RGB, WHITE_RGB, formatHex, parseHex, type RGB } from "../colour/rgb.js";
import { printToConsole } from "../paint/ansi.js";
import { probeTerminalBackground, type BackgroundProbe } from "./terminal.js";
import {
  backgroundFromColorFgBg,
  backgroundFromColorScheme,
  colourFromTerminalBackground,
  COLORFGBG_VAR,
  environmentGround,
  TERMINAL_BACKGROUND_VAR,
  TERMINAL_COLOR_SCHEME_VAR,
  type EnvironmentGround,
  type GroundVar,
} from "../paint/environment.js";
import { NEWLINE } from "../text/chars.js";
import { BEL, BOLD, DIM, ESC, RESET, sgr, truecolorCodes } from "../paint/escapes.js";

const PROBE_TIMEOUT_MS = 1000;
const RENDER_TIMEOUT_MS = 100;

const CYAN: RGB = { r: 0, g: 187, b: 187 };
const ORANGE: RGB = { r: 255, g: 140, b: 0 };

const TINT_STEPS = [0.05, 0.08, 0.1, 0.15, 0.2, 0.4, 0.6];

const THEMES_SHOWN = ["default", "forest", "mono", "classic", "redux", "neon"];

const GANTT = [
  "gantt",
  "  dateFormat YYYY-MM-DD",
  "  section Build",
  "  Parse :a, 2026-01-01, 4d",
  "  Layout :b, after a, 3d",
  "  section Ship",
  "  Paint :c, after b, 2d",
].join(NEWLINE);

const FLOW = ["flowchart LR", "  subgraph Renderer", "    A[Parse] --> B[Layout]", "  end", "  B --> C[Paint]"].join(
  NEWLINE
);

const bg = (rgb: RGB): string => sgr(...truecolorCodes(rgb, false));
const fg = (rgb: RGB): string => sgr(...truecolorCodes(rgb, true));

const visible = (bytes: string): string =>
  bytes.replaceAll(ESC, "ESC").replaceAll(BEL, "BEL").replace(/[\x00-\x1f]/gu, (c) => `\\x${c.charCodeAt(0).toString(16).padStart(2, "0")}`);

const line = (label: string, value: string): string => `  ${label.padEnd(26)} ${value}`;

const inkOn = (rgb: RGB): RGB => (sideOf(rgb) === DARK_BACKGROUND ? WHITE_RGB : BLACK_RGB);

const swatch = (rgb: RGB, text: string): string => `${bg(rgb)}${fg(inkOn(rgb))} ${text} ${RESET}`;

interface Report {
  readonly stated: string | undefined;
  readonly tty: boolean;
  readonly probe: BackgroundProbe | undefined;
  readonly variables: ReadonlyArray<{ readonly name: GroundVar; readonly value: string | undefined; readonly reads: string | undefined }>;
  readonly environment: EnvironmentGround | undefined;
  readonly ground: Ground | undefined;
  readonly source: "--background" | "OSC 11" | GroundVar | "none";
}

async function gather(stated: string | undefined): Promise<Report> {
  const tty = process.stdout.isTTY === true;
  const probe = tty ? await probeTerminalBackground(PROBE_TIMEOUT_MS) : undefined;
  const env = process.env;
  const variables: Report["variables"] = [
    { name: TERMINAL_BACKGROUND_VAR, value: env[TERMINAL_BACKGROUND_VAR], reads: colourFromTerminalBackground(env[TERMINAL_BACKGROUND_VAR]) },
    { name: TERMINAL_COLOR_SCHEME_VAR, value: env[TERMINAL_COLOR_SCHEME_VAR], reads: backgroundFromColorScheme(env[TERMINAL_COLOR_SCHEME_VAR]) },
    { name: COLORFGBG_VAR, value: env[COLORFGBG_VAR], reads: backgroundFromColorFgBg(env[COLORFGBG_VAR]) },
  ];
  const environment = environmentGround(env);
  let source: Report["source"] = "none";
  let chosen: string | undefined;
  if (stated !== undefined) {
    source = "--background";
    chosen = stated;
  } else if (probe?.colour != undefined) {
    source = "OSC 11";
    chosen = probe.colour;
  } else if (environment !== undefined) {
    source = environment.variable;
    chosen = environment.value;
  }
  return { stated, tty, probe, variables, environment, ground: groundOf(chosen), source };
}

function facts(report: Report): string[] {
  const rows = [`${BOLD}What the terminal says${RESET}`, ""];
  rows.push(line("stdout is a TTY", report.tty ? "yes" : "no (the terminal is not asked: a pipe has no background)"));
  rows.push(line("--background", report.stated ?? "unstated"));
  if (report.probe !== undefined) {
    const p = report.probe;
    rows.push(line("OSC 11 reply", p.reply === undefined ? "none" : visible(p.reply)));
    rows.push(line("OSC 11 colour", p.colour ?? "none"));
    rows.push(line("OSC 11 elapsed", `${p.elapsedMs.toFixed(1)} ms (probe window ${PROBE_TIMEOUT_MS} ms, render window ${RENDER_TIMEOUT_MS} ms)`));
    if (p.failure !== undefined) rows.push(line("OSC 11 failure", p.failure));
    if (p.colour !== undefined && p.elapsedMs > RENDER_TIMEOUT_MS) {
      rows.push(line("", `${BOLD}the reply came after the render window: a plain render would have missed it${RESET}`));
    }
  }
  for (const { name, value, reads } of report.variables) {
    rows.push(line(name, value === undefined ? "unset" : `${value} (reads as: ${reads ?? "nothing, unreadable"})`));
  }
  rows.push("");
  if (report.ground === undefined) {
    rows.push(line("resolved ground", "none: themes are drawn as declared, tints assume black"));
  } else {
    rows.push(line("resolved ground", `${formatHex(report.ground.rgb)} (${report.ground.side}) from ${report.source}`));
  }
  return rows;
}

function swatches(ground: Ground | undefined): string[] {
  const rows = ["", `${BOLD}Ground swatch${RESET}  ${DIM}the first block must vanish against your background${RESET}`, ""];
  const page = ground?.rgb ?? BLACK_RGB;
  rows.push(
    `  ${swatch(page, `ground ${formatHex(page)}`)}  ${swatch(BLACK_RGB, "black #000000")}  ${swatch(WHITE_RGB, "white #FFFFFF")}`
  );
  rows.push("");
  rows.push(`${BOLD}Tints on the ground${RESET}  ${DIM}each row: the ink washed onto the page at the strength shown${RESET}`);
  rows.push("");
  for (const [name, ink] of [["white", WHITE_RGB], ["cyan", CYAN], ["orange", ORANGE]] as const) {
    let row = `  ${name.padEnd(8)} on ground `;
    for (const by of TINT_STEPS) row += swatch(mixRGB(page, ink, by), `${Math.round(by * 100)}%`);
    rows.push(row);
    if (ground !== undefined && (page.r !== 0 || page.g !== 0 || page.b !== 0)) {
      let onBlack = `  ${"".padEnd(8)} on black  `;
      for (const by of TINT_STEPS) onBlack += swatch(mixRGB(BLACK_RGB, ink, by), `${Math.round(by * 100)}%`);
      rows.push(onBlack);
    }
  }
  return rows;
}

function themes(ground: Ground | undefined, width: number): string {
  const parts = ["", `${BOLD}Themes on this ground${RESET}  ${DIM}twin of the side chosen by the library${RESET}`, ""];
  const options = ground === undefined ? { width } : { width, background: formatHex(ground.rgb) };
  for (const name of THEMES_SHOWN) {
    const twin = ground === undefined ? name : twinOf(name, ground.side);
    parts.push(`  ${BOLD}${name}${RESET}${twin === name ? "" : ` ${DIM}-> ${twin}${RESET}`}`);
    for (const source of [FLOW, GANTT]) {
      parts.push(printToConsole(renderThemedText(source, options, name), width).replace(/\n+$/u, ""));
    }
    parts.push("");
  }
  return parts.join(NEWLINE);
}

export async function runBackgroundCheck(stated: string | undefined, width: number): Promise<void> {
  const report = await gather(stated);
  const sections = [...facts(report), ...swatches(report.ground)];
  process.stdout.write(sections.join(NEWLINE) + NEWLINE);
  process.stdout.write(themes(report.ground, width) + NEWLINE);
  if (report.ground !== undefined) {
    const hex = parseHex(formatHex(report.ground.rgb));
    if (hex !== undefined) process.stdout.write(`${DIM}Side read off the colour: ${sideOf(hex)}.${RESET}${NEWLINE}`);
  }
}
