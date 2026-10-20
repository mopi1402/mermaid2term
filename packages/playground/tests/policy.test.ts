// A shared source must not make the viewer's browser reach another host: the deployment's CSP forbids it.

import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const read = (file: string) => fs.readFileSync(path.resolve(import.meta.dirname, file), "utf8");

const deployment: unknown = JSON.parse(read("../../../vercel.json"));
const isObject = (value: unknown): value is object => typeof value === "object" && value !== null; // boundary: JSON.parse answers null for a JSON null

const headers = (): Map<string, string> => {
  const found = new Map<string, string>();
  if (!isObject(deployment) || !("headers" in deployment)) return found;
  const rules = deployment.headers;
  if (!Array.isArray(rules)) return found;
  for (const rule of rules) {
    if (!isObject(rule) || !("headers" in rule) || !Array.isArray(rule.headers)) continue;
    for (const header of rule.headers) {
      if (typeof header?.key === "string" && typeof header.value === "string") found.set(header.key.toLowerCase(), header.value);
    }
  }
  return found;
};

const directives = (): Map<string, string[]> => {
  const policy = headers().get("content-security-policy") ?? "";
  const found = new Map<string, string[]>();
  for (const part of policy.split(";")) {
    const [name, ...sources] = part.trim().split(/\s+/u);
    if (name !== undefined && name !== "") found.set(name, sources);
  }
  return found;
};

describe("the deployment's security headers", () => {
  it("lets no image, request or fallback reach another origin", () => {
    const policy = directives();
    for (const name of ["default-src", "img-src", "connect-src", "font-src", "style-src", "script-src"]) {
      const sources = policy.get(name);
      expect(sources, name).toBeDefined();
      for (const source of sources ?? []) expect(source, name).toMatch(/^('[^']+'|data:|blob:)$/u);
    }
    expect(policy.get("object-src")).toEqual(["'none'"]);
    expect(policy.get("frame-ancestors")).toEqual(["'none'"]);
  });

  it("allows the page's inline script by its hash, so an edit to it shows here", () => {
    const scripts = [...read("../index.html").matchAll(/<script>([\s\S]*?)<\/script>/gu)];
    expect(scripts.length).toBeGreaterThan(0);
    const allowed = directives().get("script-src") ?? [];
    expect(allowed).not.toContain("'unsafe-inline'");
    for (const [, body] of scripts) {
      expect(allowed).toContain(`'sha256-${crypto.createHash("sha256").update(body ?? "").digest("base64")}'`);
    }
  });

  it("refuses sniffing and sends no referrer", () => {
    expect(headers().get("x-content-type-options")).toBe("nosniff");
    expect(headers().get("referrer-policy")).toBe("no-referrer");
  });
});
