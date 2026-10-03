import { numberOf, splitLines } from "../text/format.js";
import { NEWLINE } from "../text/chars.js";
import { QUOTE, SAFE_QUOTE } from "../source/quotes.js";

interface JsonObject {
  readonly [key: string]: JsonValue;
}

type JsonValue = number | string | boolean | undefined | JsonValue[] | JsonObject;

const isObject = (value: JsonValue): value is JsonObject => typeof value === "object" && !Array.isArray(value);
const isNumber = (value: JsonValue): value is number => typeof value === "number";
const present = (value: JsonValue): boolean => value !== undefined && value !== "" && value !== 0 && value !== false;

const written = (value: JsonValue): string => (typeof value === "object" ? JSON.stringify(value) : String(value));

function parseJson(data: string): JsonValue {
  const fromJson = (value: unknown): JsonValue => {
    if (value === null) return undefined; // boundary: JSON's null, read here and nowhere else
    if (Array.isArray(value)) return value.map(fromJson);
    if (typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, fromJson(item)]));
    if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") return value;
    throw new TypeError(`ingest: JSON holds no ${typeof value}`);
  };
  return fromJson(JSON.parse(data));
}

const TREEMAP_INDENT = 4;
const MINDMAP_INDENT = 2;

const pad = (indent: number): string => " ".repeat(indent);

function toTreemap(data: JsonValue): string {
  const lines = ["treemap-beta"];

  const walk = (obj: JsonValue, indent: number = TREEMAP_INDENT): void => {
    if (isObject(obj)) {
      for (const [key, val] of Object.entries(obj)) {
        if (isObject(val)) {
          lines.push(`${pad(indent)}"${key}"`);
          walk(val, indent + TREEMAP_INDENT);
        } else if (Array.isArray(val)) {
          lines.push(`${pad(indent)}"${key}"`);
          for (const item of val) walk(item, indent + TREEMAP_INDENT);
        } else if (val !== undefined) {
          lines.push(`${pad(indent)}"${key}": ${written(val)}`);
        }
      }
    } else if (Array.isArray(obj)) {
      for (const item of obj) walk(item, indent);
    }
  };

  walk(data);
  return lines.join(NEWLINE);
}

function toPie(data: JsonValue): string {
  const lines = ["pie"];

  const slice = (key: string, val: JsonValue): void => {
    if (isNumber(val)) lines.push(`${pad(TREEMAP_INDENT)}"${key}" : ${val}`);
  };

  if (isObject(data)) {
    for (const [key, val] of Object.entries(data)) slice(key, val);
  } else if (Array.isArray(data)) {
    for (const item of data) {
      if (isObject(item)) for (const [key, val] of Object.entries(item)) slice(key, val);
    }
  }

  return lines.join(NEWLINE);
}

function toMindmap(data: JsonValue): string {
  const lines = ["mindmap"];

  const walk = (obj: JsonValue, indent: number = MINDMAP_INDENT): void => {
    if (isObject(obj)) {
      for (const [key, val] of Object.entries(obj)) {
        lines.push(`${pad(indent)}${key}`);
        if (isObject(val)) walk(val, indent + MINDMAP_INDENT);
        else if (Array.isArray(val)) {
          for (const item of val) {
            if (typeof item === "string") lines.push(`${pad(indent)}  ${item}`);
            else if (isObject(item)) walk(item, indent + MINDMAP_INDENT);
          }
        }
      }
    } else if (Array.isArray(obj)) {
      for (const item of obj) {
        if (typeof item === "string") lines.push(`${pad(indent)}${item}`);
        else if (isObject(item)) walk(item, indent);
      }
    }
  };

  walk(data);
  return lines.join(NEWLINE);
}

function toFlowchart(data: JsonValue): string {
  const lines = ["graph TD"];
  const room = pad(TREEMAP_INDENT);

  const first = (item: JsonObject, ...keys: string[]): JsonValue => {
    for (const key of keys) {
      if (present(item[key])) return item[key];
    }
    return undefined;
  };

  if (Array.isArray(data)) {
    for (const item of data) {
      if (!isObject(item)) continue;
      const src = first(item, "from", "source", "src");
      const tgt = first(item, "to", "target", "dst");
      const label = item["label"];
      if (src !== undefined && tgt !== undefined) {
        if (present(label)) lines.push(`${room}${written(src)}-->|${written(label)}|${written(tgt)}`);
        else lines.push(`${room}${written(src)}-->${written(tgt)}`);
      }
    }
  } else if (isObject(data)) {
    const edges = data["edges"] ?? [];
    if (Array.isArray(edges)) {
      for (const item of edges) {
        if (!isObject(item)) continue;
        const src = first(item, "from", "source");
        const tgt = first(item, "to", "target");
        if (src !== undefined && tgt !== undefined) lines.push(`${room}${written(src)}-->${written(tgt)}`);
      }
    }
  }

  return lines.join(NEWLINE);
}

const DATASETS = ["bar", "line"] as const;
const LIST_SEPARATOR = ", ";

function toXYChart(data: JsonValue): string {
  const lines = ["xychart-beta"];
  const room = pad(TREEMAP_INDENT);
  const axis = (categories: string[]): string => `${room}x-axis [${categories.join(LIST_SEPARATOR)}]`;
  const counted = (length: number): string[] => Array.from({ length }, (_, i) => String(i + 1));
  const listed = (values: readonly JsonValue[]): string => values.filter(isNumber).map(String).join(LIST_SEPARATOR);

  if (Array.isArray(data) && data.every(isNumber)) {
    lines.push(axis(counted(data.length)));
    lines.push(`${room}bar [${listed(data)}]`);
  } else if (isObject(data)) {
    if (DATASETS.some((name) => name in data)) {
      let maxLength = 0;
      for (const name of DATASETS) {
        const series = data[name];
        if (Array.isArray(series)) maxLength = Math.max(maxLength, series.length);
      }
      lines.push(axis(counted(maxLength)));
      for (const name of DATASETS) {
        const series = data[name];
        if (Array.isArray(series)) lines.push(`${room}${name} [${listed(series)}]`);
      }
    } else {
      const categories = Object.keys(data);
      lines.push(axis(categories));
      lines.push(`${room}bar [${listed(categories.map((key) => data[key]))}]`);
    }
  }

  return lines.join(NEWLINE);
}

const FIRST_FIELD_RE = /^(\S+)\s+([\s\S]*)$/u;

function fromTabular(data: string, diagramType: JsonType): string {
  const entries: Array<readonly [string, number]> = [];
  for (const raw of splitLines(data.trim())) {
    const line = raw.trim();
    if (line === "") continue;
    const parts = FIRST_FIELD_RE.exec(line) ?? undefined;
    if (parts === undefined) continue;
    const [, head, tail] = parts;
    const value = numberOf(head);
    if (value !== undefined) entries.push([tail, value]);
    else {
      const reversed = numberOf(tail);
      if (reversed !== undefined) entries.push([head, reversed]);
    }
  }

  if (entries.length === 0) throw new Error("Could not parse input as JSON or tabular data");

  const safe = (label: string): string => label.replaceAll(QUOTE, SAFE_QUOTE);

  if (diagramType === "treemap") {
    const lines = ["treemap-beta", `${pad(TREEMAP_INDENT)}"data"`];
    for (const [label, value] of entries) lines.push(`${pad(TREEMAP_INDENT * 2)}"${safe(label)}": ${value}`);
    return lines.join(NEWLINE);
  }

  if (diagramType === "pie") {
    const lines = ["pie"];
    for (const [label, value] of entries) lines.push(`${pad(TREEMAP_INDENT)}"${safe(label)}" : ${value}`);
    return lines.join(NEWLINE);
  }

  throw new Error(`Tabular input not supported for ${diagramType}`);
}

export const JSON_TYPES = ["treemap", "pie", "mindmap", "flowchart", "xychart"] as const;
export type JsonType = (typeof JSON_TYPES)[number];

const CONVERTERS: Readonly<Record<JsonType, (data: JsonValue) => string>> = {
  xychart: toXYChart,
  treemap: toTreemap,
  pie: toPie,
  mindmap: toMindmap,
  flowchart: toFlowchart,
};

export function jsonToMermaid(data: string, diagramType: JsonType): string {
  try {
    return CONVERTERS[diagramType](parseJson(data));
  } catch (e) {
    if (!(e instanceof SyntaxError)) throw e;
  }
  return fromTabular(data, diagramType);
}
