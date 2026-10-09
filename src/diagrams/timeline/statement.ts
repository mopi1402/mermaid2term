// One body line as mermaid's timeline lexer cuts it (`timeline.jison`, 11.17.0), the first rule that matches
// winning: a period runs to the first `:` or `#`, each event opens on `: ` and runs to the next `: `, and a `#`,
// a `%` or a `%%` where a token would start closes the line as a comment.
const COMMENT_RE = /^(?:#|%(?!\{)|[^}]%%)/u;
const PERIOD_RE = /^[^#:\n]+/u;
const EVENT_RE = /^:\s(?:[^:\n]|:(?!\s))+/u;
const EVENT_MARK = 2;

export interface Statement {
  readonly period: string | undefined;
  readonly events: readonly string[];
}

export const commented = (line: string): boolean => COMMENT_RE.test(line);

// undefined where mermaid's lexer meets a token it has no rule for and the parse throws.
export function statementOf(line: string): Statement | undefined {
  const period = PERIOD_RE.exec(line)?.[0];
  let rest = line.slice(period?.length ?? 0);
  const events: string[] = [];
  for (;;) {
    rest = rest.trimStart();
    if (rest === "" || commented(rest)) break;
    const event = EVENT_RE.exec(rest) ?? undefined;
    if (event === undefined) return undefined;
    events.push(event[0].slice(EVENT_MARK).trim());
    rest = rest.slice(event[0].length);
  }
  return { period: period?.trim(), events };
}
