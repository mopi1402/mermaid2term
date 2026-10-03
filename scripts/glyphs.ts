import { CHARSETS } from "../src/canvas/charsets.js";
import { must } from "../src/must.js";

const sets = [...CHARSETS.values()];
const flat = (v: unknown, path: string, out: Map<string, string>): void => {
  if (typeof v === "string") out.set(path, v);
  else if (Array.isArray(v)) out.set(path, v.join(" "));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) flat(x, path === "" ? k : `${path}.${k}`, out);
};
const tables = sets.map((cs) => { const m = new Map<string, string>(); flat(cs, "", m); return m; });
const fields = [...tables[0].keys()].filter((f) => f !== "name");
const points = (g: string): string => [...g].filter((ch) => ch !== " ").map((ch) => `U+${(must(ch.codePointAt(0))).toString(16).toUpperCase().padStart(4, "0")}`).join(" ");
const width = Math.max(...fields.map((f) => f.length));
console.log(`${"field".padEnd(width)}  ${sets.map((cs) => cs.name.padEnd(14)).join("  ")}`);
for (const f of fields) {
  const values = tables.map((t) => t.get(f) ?? "");
  const differ = new Set(values).size > 1 ? "*" : " ";
  console.log(`${f.padEnd(width)} ${differ}${values.map((v) => v.padEnd(14)).join("  ")}  ${values.map(points).join(" | ")}`);
}
