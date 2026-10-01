const LINE_BREAK_RE = /\r?\n/u;

export function splitLines(text: string): string[] {
  if (text === "") return [];
  const lines = text.split(LINE_BREAK_RE);
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

export const WORD_CHARS = "\\p{L}\\p{N}_";
export const WORD_CHAR = `[${WORD_CHARS}]`;

export function stripChars(text: string, chars: string, left = true, right = true): string {
  const set = new Set([...chars]);
  let start = 0;
  let end = text.length;
  if (left) while (start < end && set.has(text[start])) start++;
  if (right) while (end > start && set.has(text[end - 1])) end--;
  return text.slice(start, end);
}

export function numberOf(text: string): number | undefined {
  const trimmed = text.trim();
  if (trimmed === "") return undefined;
  const value = Number(trimmed);
  return Number.isNaN(value) ? undefined : value;
}

const INTEGER_RE = /^[+-]?\d+$/u;

export function integerOf(text: string): number | undefined {
  const trimmed = text.trim();
  return INTEGER_RE.test(trimmed) ? Number.parseInt(trimmed, 10) : undefined;
}

// d3-format's grouping `,`, its precision `.N` and its `f`, `d` and `%` types, or none (`~g`, 12 digits by default);
// undefined for any other specifier.
const D3_SPEC_RE = /^(,)?(?:\.(\d+))?([fd%])?$/u;
const D3_GENERAL_PRECISION = 12;
const D3_FIXED_PRECISION = 6;
const D3_PERCENT = "%";
const LEADING_DIGITS_RE = /^\d+/u;
const THOUSANDS_RE = /\B(?=(\d{3})+$)/gu;
const MANTISSA_ZEROS_RE = /(\.\d*?)0+(?=e|$)/u;
const BARE_POINT_RE = /\.(?=e|$)/u;

const grouped = (text: string): string => text.replace(LEADING_DIGITS_RE, (digits) => digits.replace(THOUSANDS_RE, ","));
const trimmedZeros = (text: string): string => (text.includes(".") ? text.replace(MANTISSA_ZEROS_RE, "$1").replace(BARE_POINT_RE, "") : text);

export function d3Format(spec: string): ((value: number) => string) | undefined {
  const parts = D3_SPEC_RE.exec(spec) ?? undefined;
  if (parts === undefined) return undefined;
  const [, comma, digits, type] = parts;
  const precision = digits === undefined ? undefined : Number(digits);
  const group = (text: string): string => (comma === undefined ? text : grouped(text));
  return (value) => {
    if (type === "f") return group(value.toFixed(precision ?? D3_FIXED_PRECISION));
    if (type === D3_PERCENT) return group((value * 100).toFixed(precision ?? D3_FIXED_PRECISION)) + D3_PERCENT;
    if (type === "d") return group(String(Math.round(value)));
    return group(trimmedZeros(value.toPrecision(Math.max(1, precision ?? D3_GENERAL_PRECISION))));
  };
}

export const messageOf =(thrown: unknown): string => (thrown instanceof Error ? thrown.message : String(thrown));

export const words = (line: string): string[] => line.split(/\s+/).filter((w) => w !== "");

export const indentOf = (line: string): number => line.length - line.trimStart().length;

// Each part trimmed, the empty ones dropped.
export const kept = (parts: readonly string[]): string[] => parts.map((part) => part.trim()).filter((part) => part !== "");

export const listed = (text: string, separator = ","): string[] => kept(text.split(separator));
