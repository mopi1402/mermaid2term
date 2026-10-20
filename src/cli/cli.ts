import fs from "node:fs";
import { jsonToMermaid } from "./ingest.js";
import { declaredType, render, renderThemedText, type Options } from "../index.js";
import { CONSOLE_WIDTH, printToConsole } from "../paint/ansi.js";
import { Text } from "../paint/text.js";
import { runBackgroundCheck } from "./background-check.js";
import { messageOf } from "../text/format.js";
import { NEWLINE } from "../text/chars.js";
import { FAILED, MISUSED, OK, PROGRAM, err, out } from "./exits.js";
import { UsageError, parseArgs, type Args, type Parsed } from "./args.js";
import { HELP, version } from "./help.js";
import { TOO_WIDE, consoleWidth, plainOf, targetWidth, useColor } from "./console.js";
import { widestLine } from "../text/width.js";
import { groundAsked, themeChosen } from "./ground.js";
import { applyShowIds, readSource } from "./source.js";
import { listThemes } from "./theme-list.js";
import { runDemo } from "./demo.js";

const OFF = new Set(["0", "false", "no"]);

const autoRotates = (env: NodeJS.ProcessEnv = process.env): boolean =>
  !OFF.has((env["MERMAID2TERM_AUTOROTATE"] ?? "").trim().toLowerCase());

const renderOptions = (args: Args): Options => ({
  charset: args.charset,
  paddingX: args.paddingX,
  paddingY: args.paddingY,
  roundedEdges: !args.sharpEdges,
  borders: args.borders,
  gap: args.gap,
  autoRotate: autoRotates(),
});

export async function main(argv: readonly string[]): Promise<number> {
  let parsed: Parsed;
  try {
    parsed = parseArgs(argv);
  } catch (e) {
    if (!(e instanceof UsageError)) throw e;
    err(`usage: ${PROGRAM} [-h] ... [file]`);
    err(`${PROGRAM}: error: ${e.message}`);
    return MISUSED;
  }
  if ("shown" in parsed) {
    out(parsed.shown === "help" ? HELP : `${PROGRAM} ${version()}`);
    return OK;
  }
  const args = parsed;

  if (args.themes) return listThemes();
  if (args.checkBackground) {
    await runBackgroundCheck(args.background, consoleWidth());
    return OK;
  }
  if (args.demo !== undefined) return runDemo(args, useColor() ? await groundAsked(args) : undefined);

  let source = await readSource(args);
  if (source === undefined) return FAILED;

  source = source.trim();
  if (source === "") {
    err("Error: Empty input.");
    return FAILED;
  }

  if (args.json !== undefined) {
    try {
      source = jsonToMermaid(source, args.json);
    } catch (e) {
      err(`Error converting JSON to ${args.json}: ${messageOf(e)}`);
      return FAILED;
    }
  }

  const renderSource = args.showIds ? applyShowIds(source) : source;
  const target = targetWidth(args);
  const colour = useColor();
  const background = colour ? await groundAsked(args) : undefined;
  const options: Options = {
    ...renderOptions(args),
    ...(target === undefined ? {} : { width: target }),
    ...(args.height === undefined ? {} : { height: args.height }),
    ...(background === undefined ? {} : { background }),
  };

  try {
    const result: string | Text = colour
      ? renderThemedText(renderSource, options, themeChosen(args))
      : render(renderSource, options);

    const actual = widestLine(plainOf(result));
    if (target !== undefined && actual > target) err(TOO_WIDE(actual, target, declaredType(renderSource)));

    if (args.output !== undefined) {
      try {
        const body =
          typeof result === "string" ? result + NEWLINE : printToConsole(result, Math.max(actual, CONSOLE_WIDTH));
        fs.writeFileSync(args.output, body, "utf8");
      } catch (e) {
        err(`Error writing to ${args.output}: ${messageOf(e)}`);
        return FAILED;
      }
    } else if (typeof result === "string") out(result);
    // The console is never narrower than the drawing it prints: a drawing already fitted must not be folded a second
    // time, least of all against the 80-column fallback a pipe leaves behind.
    else process.stdout.write(printToConsole(result, Math.max(actual, consoleWidth())));
  } catch (e) {
    err(`Error rendering diagram: ${messageOf(e)}`);
    return FAILED;
  }

  return OK;
}
