import { QUOTE } from "./quotes.js";

// mermaid 12's `directiveRegex`: the type, then a bare word or everything up to the closing `}%%` as JSON.
const DIRECTIVE_RE = /%{2}\{\s*(?:(\w+)\s*:|(\w+))\s*(?:(\w+)|((?:(?!\}%{2}).|\r?\n)*))?\s*(?:\}%{2})?/giu;
const INIT_TYPE_RE = /(?:init\b)|(?:initialize\b)/u;
const SINGLE = "'";
// Not one of mermaid's config keys: the sanitizer that runs over several directives drops it.
const CONFIG_KEY = "config";
// mermaid's `assignWithDepth` default.
const MERGE_DEPTH = 2;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null; // boundary: JSON.parse's one null, refused here so nothing downstream meets it

// mermaid's `assignWithDepth`: records merged key by key down to `depth`, a scalar never written over a record.
function assignWithDepth(into: Record<string, unknown>, from: Record<string, unknown>, depth: number): Record<string, unknown> {
  if (depth <= 0) return Object.assign(into, from);
  for (const [key, value] of Object.entries(from)) {
    const held = into[key];
    if (isRecord(value)) {
      const base = held === undefined ? (Array.isArray(value) ? [] : {}) : held;
      if (isRecord(base)) into[key] = assignWithDepth(base, value, depth - 1);
    } else if (!isRecord(held)) into[key] = value;
  }
  return into;
}

// Every `%%{init: {...}}%%` or `%%{initialize: ...}%%`, as mermaid 12's `detectInit` reads them: quotes all turned
// double first, one directive taken as written, several merged in order after the sanitizer dropped their `config`,
// and one that is no JSON losing them all.
export function initConfig(source: string): Record<string, unknown> | undefined {
  const text = source.trim().replaceAll(SINGLE, QUOTE);
  const found: unknown[] = [];
  for (const match of text.matchAll(DIRECTIVE_RE)) {
    const type = match[1] ?? match[2];
    if (!INIT_TYPE_RE.test(type)) continue;
    if (match[3] !== undefined) found.push(match[3].trim());
    else if (match[4] === undefined || match[4].trim() === "") found.push(undefined);
    else {
      try {
        found.push(JSON.parse(match[4].trim()));
      } catch {
        return undefined;
      }
    }
  }
  if (found.length === 0) return undefined;
  if (found.length === 1) return isRecord(found[0]) ? found[0] : undefined;
  let merged: Record<string, unknown> = {};
  for (const config of found) {
    if (!isRecord(config)) continue;
    merged = assignWithDepth(merged, Object.fromEntries(Object.entries(config).filter(([key]) => key !== CONFIG_KEY)), MERGE_DEPTH);
  }
  return merged;
}
