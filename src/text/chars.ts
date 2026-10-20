export const NEWLINE = "\n";
export const TAB = "\t";
export const SPACE = " ";
export const NUL = "\0";
export const NBSP = "\u00a0";
export const ELLIPSIS = "\u2026";
// What a terminal would run rather than draw: every C0 control but tab and line ends, DEL, every C1 control.
export const CONTROL_RE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]|\r(?!\n)/u;
