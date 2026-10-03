// A parser's statement rules, tried in order on a line: the first that matches, and holds, reads it.
export interface LineRule<R> {
  readonly pattern: RegExp;
  // Whether the rule holds where it matches; a line it passes on goes to the rules after it.
  readonly when?: (reading: R) => boolean;
  readonly apply: (reading: R, found: RegExpExecArray, line: string) => void;
}

// Whether a rule read `line`.
export function applyRules<R>(rules: ReadonlyArray<LineRule<R>>, reading: R, line: string): boolean {
  for (const rule of rules) {
    const found = rule.pattern.exec(line) ?? undefined;
    if (found === undefined || (rule.when !== undefined && !rule.when(reading))) continue;
    rule.apply(reading, found, line);
    return true;
  }
  return false;
}
