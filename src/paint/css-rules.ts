export type CssRules = ReadonlyMap<string, ReadonlyMap<string, string>>;

export function readCssRules(css: string): CssRules {
  const rules = new Map<string, Map<string, string>>();
  const RULE_RE = /([^{}]+)\{([^{}]*)\}/gu;
  for (const found of css.matchAll(RULE_RE)) {
    const selectors = found[1].split(",").map((s) => s.trim().replace(/\s+/gu, " "));
    const body = found[2];
    for (const selector of selectors) {
      if (selector === "" || selector.startsWith("@")) continue;
      const props = rules.get(selector) ?? new Map<string, string>();
      for (const declaration of body.split(";")) {
        const at = declaration.indexOf(":");
        if (at < 0) continue;
        const name = declaration.slice(0, at).trim().toLowerCase();
        const value = declaration.slice(at + 1).replace(/!important/giu, "").trim().toLowerCase();
        if (name !== "" && value !== "") props.set(name, value);
      }
      rules.set(selector, props);
    }
  }
  return rules;
}

// A class a node wears, as mermaid 12 lets a rule reach it past its own `#svg .node` rules (measured headless): `.hot rect`
// and the other shapes on the shape, `.hot span`, `.hot p` or `.hot .nodeLabel` on the words; `.hot`, `.hot > *` and
// `.hot .label` reach nothing.
const CLASS_RULE_RE = /^\.([\w-]+) (?:rect|polygon|path|circle|ellipse|span|p|\.nodeLabel)$/u;

export function classRulesOf(css: string): Map<string, Map<string, string>> {
  const classes = new Map<string, Map<string, string>>();
  for (const [selector, props] of readCssRules(css)) {
    const name = (CLASS_RULE_RE.exec(selector) ?? undefined)?.[1];
    if (name !== undefined) classes.set(name, new Map([...(classes.get(name) ?? []), ...props]));
  }
  return classes;
}
