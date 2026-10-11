import { COMMENT, STRING } from "../@common/langium.js";

// The terminals of mermaid's `pie.langium` (STRING, NUMBER_PIE, TITLE, parser 1.2.1), a `%%` comment closing any statement.
const NUMBER = String.raw`-?(?:[0-9]+\.[0-9]+|0|[1-9][0-9]*)`;
const WORD_END = String.raw`(?=%%|\s|$)`;

export const HEADER_RE = new RegExp(String.raw`^pie${WORD_END}[\t ]*(?:(showData)${WORD_END})?`, "u");
export const SECTION_RE = new RegExp(String.raw`^(${STRING})[\t ]*:[\t ]*(${NUMBER})[\t ]*${COMMENT}$`, "u");
export const BLANK_RE = new RegExp(String.raw`^${COMMENT}$`, "u");
