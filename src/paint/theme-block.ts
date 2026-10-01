import { dotted, yamlMap } from "../source/yaml.js";

export const THEME_KEY = "theme";  // keyword: mermaid's own config key here, not a style key
export const CSS_KEY = "themeCSS";
export const VARIABLES_KEY = "themeVariables";
export const CONFIG_KEY = "config";  // keyword: mermaid's own frontmatter key here, not a style key

export interface MermaidThemeText {
  readonly theme: string | undefined;
  readonly variables: ReadonlyMap<string, string>;
  readonly css: string | undefined;
}

// A theme block, its keys under a `config:` when it has one, at its root when it is a bare theme file; a nested
// variable section, `xyChart:`, is read as `xyChart.plotColorPalette`.
export function readMermaidTheme(text: string): MermaidThemeText {
  const root = yamlMap(text);
  const config = root.get(CONFIG_KEY);
  const node = config instanceof Map ? config : root;
  const theme = node.get(THEME_KEY);
  const css = node.get(CSS_KEY);
  const variables = node.get(VARIABLES_KEY);
  return {
    theme: typeof theme === "string" ? theme : undefined,
    variables: new Map(Object.entries(variables instanceof Map ? dotted(variables) : {})),
    css: typeof css === "string" ? css : undefined,
  };
}
