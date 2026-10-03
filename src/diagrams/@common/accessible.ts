// `accTitle:`, `accDescr:` and `accDescr {` speak to a screen reader; the block runs until its `}`.
const ACC_LINE_RE = /^\s*acc(?:title|descr)\s*:/iu;
const ACC_BLOCK_RE = /^\s*accdescr\s*\{/iu;
const ACC_CLOSE = "}";

// Body lines less every accessibility statement, which mermaid stores off the drawing; a kept line keeps its indent.
export function withoutAccessible(lines: readonly string[]): string[] {
  const kept: string[] = [];
  let inBlock = false;
  for (const line of lines) {
    if (inBlock) inBlock = !line.includes(ACC_CLOSE);
    else if (ACC_BLOCK_RE.test(line)) inBlock = !line.includes(ACC_CLOSE);
    else if (!ACC_LINE_RE.test(line)) kept.push(line);
  }
  return kept;
}
