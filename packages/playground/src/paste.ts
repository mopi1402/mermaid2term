import { must } from "@/must";

const BLANK_RE = /^[^\S\n]*$/u;
const INDENT_RE = /^[^\S\n]*/u;

const indentOf = (line: string): string => must(INDENT_RE.exec(line) ?? undefined)[0];

const shared = (one: string, two: string): string => {
  let at = 0;
  while (at < one.length && at < two.length && one[at] === two[at]) at += 1;
  return one.slice(0, at);
};

// Only the margin every line shares goes, so the relative indents a mindmap or a frontmatter read survive.
export function dedented(text: string): string {
  const lines = text.split("\n");
  if (lines.length < 2) return text;
  const held = lines.filter((line) => !BLANK_RE.test(line));
  if (held.length === 0) return text;
  let common = indentOf(must(held[0]));
  for (const line of held.slice(1)) {
    common = shared(common, indentOf(line));
    if (common === "") return text;
  }
  return lines.map((line) => (line.startsWith(common) ? line.slice(common.length) : line.trimStart())).join("\n");
}
