import { terminalUrl } from "../../text/width.js";
import { colourToHex } from "../../colour/colours.js";
import { PROP_STROKE, parseCssProps } from "../../source/css.js";
import { SEMICOLON, keywordRest } from "../../source/lines.js";
import type { GanttTask } from "./model.js";

const SPACE_RE = /\s/u;


const CLICK = "click";
const HREF_RE = /\bhref\s+"([^"]*)"/iu;

// mermaid's gantt `click <ids> [call fn(args)] [href "url"]`: the whole line is the statement, and only the link
// has a terminal counterpart, though either marks the task clickable. Ids name tasks already read, as `setLink`
// looks them up when the line is parsed.
export function readClick(line: string, byId: ReadonlyMap<string, GanttTask>): boolean {
  const rest = keywordRest(line, CLICK);
  if (rest === undefined) return false;
  const trimmed = rest.trimStart();
  const cut = trimmed.search(SPACE_RE);
  const ids = cut < 0 ? trimmed : trimmed.slice(0, cut);
  const href = HREF_RE.exec(cut < 0 ? "" : trimmed.slice(cut)) ?? undefined;
  const url = href === undefined ? undefined : terminalUrl(href[1]);
  for (const id of ids.split(",")) {
    const task = byId.get(id);
    if (task === undefined) continue;
    task.clickable = true;
    if (url !== undefined) task.link = url;
  }
  return true;
}

const OFF = "off";

// `todayMarker off` alone hides the line; any other value is the style mermaid sets on it, commas for semicolons.
export function readTodayMarker(value: string): { shown: boolean; ink: string | undefined } {
  const said = value.split(SEMICOLON)[0];
  if (said === OFF) return { shown: false, ink: undefined };
  return { shown: true, ink: colourToHex(parseCssProps(said).get(PROP_STROKE) ?? "") };
}
