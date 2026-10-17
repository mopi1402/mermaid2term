import Anser from "anser";
import { displayWidth } from "@tayomi/mermaid2term";
import { CORED_RING, RING, SMALL_RING, blockCss, isBlock } from "@/paint";

type Token = ReturnType<typeof Anser.ansiToJson>[number];

const NARROW_CELL = 1;

const ALWAYS_RANGES: ReadonlyArray<readonly [number, number]> = [[0x20, 0x7e]];

const REGULAR_RANGES: ReadonlyArray<readonly [number, number]> = [[0x2500, 0x257f]];

export const PLAIN_RANGES: ReadonlyArray<readonly [number, number]> = [...ALWAYS_RANGES, ...REGULAR_RANGES];

const HEX = 16;
const DIGITS = 4;
const bound = (point: number): string => `\\u${point.toString(HEX).padStart(DIGITS, "0")}`;

const pattern = (ranges: ReadonlyArray<readonly [number, number]>): RegExp =>
  new RegExp(`^[${ranges.map(([low, high]) => `${bound(low)}-${bound(high)}`).join("")}]*$`, "u");

const PLAIN = pattern(PLAIN_RANGES);
const PLAIN_IN_BOLD = pattern(ALWAYS_RANGES);
const STROKES = pattern(REGULAR_RANGES);

const SEGMENTER = new Intl.Segmenter(undefined, { granularity: "grapheme" });

const NEWLINE = "\n";

const CLASS = "cell";
const ROW_CLASS = "row";
const VARIABLE = "--w";

const STAND_INS: ReadonlyMap<string, string> = new Map([
  ["\u23f5", ">"],
  ["\u23f4", "<"],
  ["\u23f6", "^"],
  ["\u23f7", "v"],
  ["\ue0b0", ">"],
  ["\ue0b2", "<"],
  ["\u25e2", "/"],
  ["\u25e4", "/"],
  ["\u25e3", "\\"],
  ["\u25e5", "\\"],
  [RING, "o"],
  [SMALL_RING, "o"],
  [CORED_RING, "o"],
]);

const BLOCK_CLASS = "block";

const BOLD = "font-weight:bold";

const DIMNESS = 50;

const halfStrength = (channels: string): string =>
  channels
    .split(",")
    .map((channel) => Math.round((Number(channel.trim()) * DIMNESS) / 100))
    .join(",");

const withoutBold = (css: string): string => css.split(";").filter((piece) => piece !== BOLD).join(";");

const ESCAPES: ReadonlyArray<readonly [RegExp, string]> = [
  [/&/g, "&amp;"],
  [/</g, "&lt;"],
  [/>/g, "&gt;"],
];

const escape = (text: string): string => ESCAPES.reduce((out, [from, to]) => out.replace(from, to), text);

const attribute = (text: string): string => escape(text).replace(/"/gu, "&quot;");

const LINK_RE = /\u001b\]8;;(.*?)\u001b\\/gu;

interface Slice {
  readonly url: string;
  readonly text: string;
}

const slices = (ansi: string): Slice[] => {
  const out: Slice[] = [];
  let url = "";
  let from = 0;
  LINK_RE.lastIndex = 0;
  for (let found = LINK_RE.exec(ansi) ?? undefined; found !== undefined; found = LINK_RE.exec(ansi) ?? undefined) {
    out.push({ url, text: ansi.slice(from, found.index) });
    url = found[1];
    from = found.index + found[0].length;
  }
  out.push({ url, text: ansi.slice(from) });
  return out;
};

const style = (token: Token): string => {
  const pieces: string[] = [];
  const dim = token.decorations.includes("dim");
  if (token.fg) pieces.push(`color:rgb(${dim ? halfStrength(token.fg) : token.fg})`);
  else if (dim) pieces.push(`color:color-mix(in srgb, currentColor ${DIMNESS}%, black)`);
  if (token.bg) pieces.push(`background-color:rgb(${token.bg})`);

  const lines: string[] = [];
  for (const decoration of token.decorations) {
    if (decoration === "bold") pieces.push(BOLD);
    else if (decoration === "italic") pieces.push("font-style:italic");
    else if (decoration === "hidden") pieces.push("visibility:hidden");
    else if (decoration === "strikethrough") lines.push("line-through");
    else if (decoration === "underline") lines.push("underline");
  }
  if (lines.length > 0) pieces.push(`text-decoration:${lines.join(" ")}`);

  return pieces.join(";");
};

export function gridLines(ansi: string): string[] {
  const lines: string[] = [];
  let line = "";

  let pending = "";
  let pendingColumns = 0;
  let pendingCss = "";
  let linkUrl = "";
  let linkStart = 0;

  // Every run, plain ones too, rides in a box of its columns, so a wall lands on its track (`index.css`).
  const declare = (columns: number, css: string): string => `${VARIABLE}:${columns}${css === "" ? "" : `;${css}`}`;

  const flush = (): void => {
    if (pending === "") return;
    line += `<span class="${CLASS}" style="${declare(pendingColumns, pendingCss)}">${pending}</span>`;
    pending = "";
    pendingColumns = 0;
  };

  const closeLink = (): void => {
    if (linkUrl === "") return;
    const inside = line.slice(linkStart);
    line = `${line.slice(0, linkStart)}<a href="${attribute(linkUrl)}" target="_blank" rel="noreferrer">${inside}</a>`;
  };

  const link = (url: string): void => {
    if (url === linkUrl) return;
    flush();
    closeLink();
    linkUrl = url;
    linkStart = line.length;
  };

  const put = (text: string, css: string): void => {
    if (css !== pendingCss) {
      flush();
      pendingCss = css;
    }
    pending += escape(text);
    pendingColumns += displayWidth(text);
  };

  const write = (text: string, css: string): void => {
    if (text === "") return;
    const plain = css.includes(BOLD) ? PLAIN_IN_BOLD : PLAIN;
    if (plain.test(text)) {
      put(text, css);
      return;
    }
    for (const { segment } of SEGMENTER.segment(text)) {
      if (plain.test(segment)) {
        put(segment, css);
        continue;
      }
      if (isBlock(segment)) {
        flush();
        line += `<span class="${CLASS} ${BLOCK_CLASS}" style="${declare(NARROW_CELL, blockCss(segment, css))}">${escape(STAND_INS.get(segment) ?? segment)}</span>`;
        continue;
      }
      if (STROKES.test(segment)) {
        put(segment, withoutBold(css));
        continue;
      }
      flush();
      line += `<span class="${CLASS}" style="${declare(displayWidth(segment), css)}">${escape(segment)}</span>`;
    }
  };

  for (const slice of slices(ansi)) {
    link(slice.url);
    for (const token of Anser.ansiToJson(slice.text, { json: true, remove_empty: true })) {
      const css = style(token);
      const parts = token.content.split(NEWLINE);
      for (let index = 0; index < parts.length; index++) {
        if (index > 0) {
          flush();
          closeLink();
          lines.push(line);
          line = "";
          pendingCss = "";
          linkStart = 0;
        }
        write(parts[index], css);
      }
    }
  }
  flush();
  closeLink();
  lines.push(line);

  return lines;
}

export const grid = (ansi: string): string =>
  gridLines(ansi)
    .map((line) => `<div class="${ROW_CLASS}">${line}</div>`)
    .join("");

