import { NEWLINE } from "../../src/text/chars.js";

// A YAML value written as it stands: a string keeps the quotes its caller gives it.
type Yaml = string | number | boolean | { readonly [key: string]: Yaml };

const FENCE = "---";
const INDENT = "  ";

const yamlOf = (map: { readonly [key: string]: Yaml }, depth: number): string =>
  Object.entries(map)
    .map(([key, value]) =>
      typeof value === "object" ? `${INDENT.repeat(depth)}${key}:${NEWLINE}${yamlOf(value, depth + 1)}` : `${INDENT.repeat(depth)}${key}: ${String(value)}${NEWLINE}`
    )
    .join("");

// A source opening on a frontmatter `config:`, given as a map or as the YAML lines themselves, each ending its line.
export const withConfig = (config: { readonly [key: string]: Yaml } | string, body: string): string =>
  `${FENCE}${NEWLINE}config:${NEWLINE}${typeof config === "string" ? config : yamlOf(config, 1)}${FENCE}${NEWLINE}${body}`;
