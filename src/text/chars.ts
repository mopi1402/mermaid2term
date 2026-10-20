export const NEWLINE = "\n";
export const TAB = "\t";
export const SPACE = " ";
export const NUL = "\0";
export const NBSP = "\u00a0";
export const ELLIPSIS = "\u2026";
// What a terminal would run or reorder rather than draw: every C0 control but tab and newline, DEL, every C1
// control, and the bidi embeddings, overrides and isolates, which turn the rest of a row around.
export const CONTROL_RE = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u;
const CONTROLS_RE = new RegExp(CONTROL_RE.source, "gu");
export const withoutControls = (text: string): string => text.replace(CONTROLS_RE, "");
// mermaid's own `cleanupText`: a CRLF or a lone CR ends a line as LF does.
export const LINE_END_RE = /\r\n?/gu;
