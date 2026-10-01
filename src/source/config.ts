import { FRONTMATTER_RE } from "./lines.js";
import { initConfig, isRecord } from "./directives.js";
import { dotted, yamlMap } from "./yaml.js";

const CONFIG_KEY = "config";  // keyword: mermaid's own frontmatter key here, not a style key
const FLOWCHART_SECTION = "flowchart";
// The sections whose mermaid diagram id is another word, where a directive's `config` lands unread: `detectInit`
// renames `config` to the id itself, `flowchart-v2` alone turned into `flowchart`.
const CONFIG_MISSES: ReadonlySet<string> = new Set(["class", "state", "xyChart"]);
const ELK_HEADER_RE = /^(?:\s*%%[^\n]*\n)*\s*flowchart-elk/u;

export type Declared = Readonly<Record<string, string>>;

// Read here, where the source names one, and handed up to the render options.
export const BORDER_MODES = ["default", "padless", "borderless"] as const;
export type BorderMode = (typeof BORDER_MODES)[number];

const scalars = (from: ReadonlyMap<string, unknown>): Record<string, string> => {
  const said: Record<string, string> = {};
  for (const [name, value] of from) if (typeof value === "string") said[name] = value;
  return said;
};

const under = (node: ReadonlyMap<string, unknown>, key: string): ReadonlyMap<string, unknown> => {
  const child = node.get(key);
  return child instanceof Map ? child : new Map<string, unknown>();
};

const written = (value: unknown): string | undefined =>
  typeof value === "string" ? value : typeof value === "number" || typeof value === "boolean" ? String(value) : undefined;

// The directive's block for `name`: for the diagram's `own` section, its `config` renamed to the diagram's id,
// which replaces what it says under the name.
function directiveSection(directive: Record<string, unknown> | undefined, name: string, own: string | undefined, body: string): unknown {
  if (directive === undefined) return undefined;
  const lands = name === own && !CONFIG_MISSES.has(name) &&!(name === FLOWCHART_SECTION && ELK_HEADER_RE.test(body));
  return lands && directive[CONFIG_KEY] !== undefined ? directive[CONFIG_KEY] : directive[name];
}

export interface SourceConfig {
  // The keys written at the block's own level, where mermaid takes `title` and `displayMode`.
  readonly top: Declared;
  // The scalar keys under `config:`, where `theme` stands.
  readonly config: Declared;
  // `config.<section>`, the block one kind owns, with the init directive's own section over it.
  section(name: string): Declared;
}

// The one reader of a source's frontmatter and init directives, the fence opening the text as mermaid's
// `frontMatterRegex` wants it. `own` names the diagram's section, where a directive's `config` lands.
export function sourceConfig(source: string, own?: string): SourceConfig {
  const text = source.trimStart();
  const block = FRONTMATTER_RE.exec(text) ?? undefined;
  const root = block === undefined ? new Map<string, unknown>() : yamlMap(block[2]);
  const config = under(root, CONFIG_KEY);
  // mermaid reads the directives past the frontmatter (`preprocessDiagram`, 12.0.0).
  const body = block === undefined ? text : text.slice(block[0].length);
  const directive = initConfig(body);
  const overs = (said: Record<string, string>, from: unknown, nests = false, prefix = ""): Record<string, string> => {
    if (!isRecord(from)) return said;
    for (const [key, value] of Object.entries(from)) {
      const spelled = written(value);
      if (spelled !== undefined) said[prefix + key] = spelled;
      else if (nests) overs(said, value, nests, `${prefix}${key}.`);
    }
    return said;
  };
  return {
    top: scalars(root),
    config: overs(scalars(config), directive),
    // `%%{init: {...}}%%` says what the frontmatter says, and says it LAST: mermaid merges the directive over the
    // frontmatter config (`preprocess.ts`, `cleanAndMerge`, 12.0.0), so a key in both is the directive's.
    section: (name: string): Declared => overs(dotted(under(config, name)), directiveSection(directive, name, own, body), true),
  };
}

const TRUE = "true";
const FALSE = "false";

// A YAML scalar read as a flag: anything else said under the key is not a flag, and says nothing.
export const flagOf = (said: Declared, key: string): boolean | undefined => {
  const value = said[key]?.toLowerCase();
  return value === TRUE ? true : value === FALSE ? false : undefined;
};
