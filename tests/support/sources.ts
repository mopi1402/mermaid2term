import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

export const ROOT = join(import.meta.dirname, "..", "..");

type Span = readonly [number, number];

const parsed = (text: string, path: string): ts.SourceFile =>
  ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

const PLAIN = "read.ts";

const literalSpans = (text: string, path: string): Span[] => {
  const file = parsed(text, path);
  const spans: Span[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isRegularExpressionLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      spans.push([node.getStart(file), node.end]);
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(file, visit);
  return spans;
};

export const quotedIn = (text: string, path = PLAIN): string[] =>
  literalSpans(text, path)
    .map(([from, to]) => text.slice(from, to))
    .filter((one) => !one.startsWith("/"))
    .map((one) => one.replace(/^[`"'}]/u, "").replace(/(?:\$\{|[`"'])$/u, ""));

const COMMENT = /\/\*[\s\S]*?\*\/|\/\/[^\n]*/gu;
const commentSpans = (text: string, literals: readonly Span[]): Span[] => {
  const inside = (at: number): boolean => literals.some(([from, to]) => at >= from && at < to);
  const spans: Span[] = [];
  for (const found of text.matchAll(COMMENT)) {
    const at = found.index;
    if (!inside(at)) spans.push([at, at + found[0].length]);
  }
  return spans;
};

const strike = (text: string, spans: readonly Span[]): string => {
  if (spans.length === 0) return text;
  const order = [...spans].sort((a, b) => a[0] - b[0]);
  let out = "";
  let at = 0;
  for (const [from, to] of order) {
    if (from < at) continue;
    out += text.slice(at, from) + text.slice(from, to).replace(/[^\n]/gu, "");
    at = to;
  }
  return out + text.slice(at);
};

export const codeOf = (text: string, path = PLAIN): string => {
  const literals = literalSpans(text, path);
  return strike(text, [...literals, ...commentSpans(text, literals)]);
};

export const uncommented = (text: string, path = PLAIN): string => strike(text, commentSpans(text, literalSpans(text, path)));

export const BOUNDARY = /\/\/ boundary:/u;

export const sources = (dir: string): string[] => {
  if (!statSync(dir).isDirectory()) return [dir];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sources(path) : name.endsWith(".ts") || name.endsWith(".tsx") ? [path] : [];
  });
};

export const assertedAt = (text: string, path = PLAIN): number[] => {
  const file = parsed(text, path);
  const lines: number[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isAsExpression(node) && !(ts.isTypeReferenceNode(node.type) && node.type.typeName.getText(file) === "const")) {
      lines.push(file.getLineAndCharacterOfPosition(node.expression.end).line);
    }
    if (ts.isTypeAssertionExpression(node)) lines.push(file.getLineAndCharacterOfPosition(node.expression.end).line);
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(file, visit);
  return lines;
};

export interface Reach {
  readonly module: string;
  readonly names: readonly string[];
  readonly typesOnly: boolean;
}

export const reaches = (text: string, path = PLAIN): Reach[] => {
  const file = parsed(text, path);
  const found: Reach[] = [];
  const named = (clause: ts.NamedImportBindings | ts.NamedExportBindings | undefined): string[] => {
    if (clause === undefined || !("elements" in clause)) return [];
    return clause.elements.map((one) => (one.propertyName ?? one.name).text);
  };
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      const inline = clause?.namedBindings !== undefined && named(clause.namedBindings).length > 0;
      found.push({
        module: node.moduleSpecifier.text,
        names: clause === undefined ? [] : named(clause.namedBindings),
        typesOnly:
          clause !== undefined &&
          clause.name === undefined &&
          (clause.isTypeOnly ||
            (inline &&
              clause.namedBindings !== undefined &&
              "elements" in clause.namedBindings &&
              clause.namedBindings.elements.every((one) => one.isTypeOnly))),
      });
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined && ts.isStringLiteral(node.moduleSpecifier)) {
      found.push({
        module: node.moduleSpecifier.text,
        names: named(node.exportClause),
        typesOnly:
          node.isTypeOnly ||
          (node.exportClause !== undefined &&
            "elements" in node.exportClause &&
            node.exportClause.elements.every((one) => one.isTypeOnly)),
      });
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      found.push({ module: node.arguments[0].text, names: [], typesOnly: false });
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(file, visit);
  return found;
};

export interface Guard {
  readonly reads: (text: string, path: string) => string;
  readonly spellers?: ReadonlySet<string>;
  readonly refuses: (line: string, raw: string) => boolean;
}

export const offenders = (dir: string, guard: Guard): string[] => {
  const found: string[] = [];
  for (const file of sources(join(ROOT, dir))) {
    const path = file.slice(ROOT.length + 1);
    if (guard.spellers?.has(path) === true) continue;
    const raw = readFileSync(file, "utf8").split("\n");
    guard
      .reads(raw.join("\n"), file)
      .split("\n")
      .forEach((line, at) => {
        if (guard.refuses(line, raw[at] ?? "")) found.push(`${path}:${at + 1}: ${line.trim()}`);
      });
  }
  return found;
};
