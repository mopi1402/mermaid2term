// The source comes out of an address byte for byte; node lacks CompressionStream, so `node:zlib` stands in.

import { describe, it, expect } from "vitest";
import zlib from "node:zlib";
import { written, read } from "@/address";
import { corpus } from "./corpus";

const standIn = (transform: (bytes: Buffer) => Buffer) =>
  class {
    readonly readable: ReadableStream<Uint8Array>;
    readonly writable: WritableStream<Uint8Array>;

    constructor() {
      const chunks: Uint8Array[] = [];
      const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk) {
          chunks.push(chunk);
        },
        flush(controller) {
          // Input zlib refuses THROWS, which breaks the stream, as the browser does too.
          controller.enqueue(new Uint8Array(transform(Buffer.concat(chunks))));
        },
      });
      this.readable = readable;
      this.writable = writable;
    }
  };

const global = globalThis as Record<string, unknown>; // boundary: the test shims the platform's own globals
global.CompressionStream ??= standIn((bytes) => zlib.deflateRawSync(bytes));
global.DecompressionStream ??= standIn((bytes) => zlib.inflateRawSync(bytes));

const addresses = await Promise.all(
  corpus.map(async ({ name, source }) => ({ name, source, fragment: await written(name, source) }))
);

describe("the address that carries the source", () => {
  it("has a corpus to run", () => {
    expect(corpus.length).toBeGreaterThan(100);
  });

  it("gives the source back as it went in, for the whole corpus", async () => {
    for (const { name, source, fragment } of addresses) {
      expect(await read(fragment), name).toEqual({ name, source });
    }
  });

  it("puts nothing in the address a URL would rewrite", () => {
    // base64url, the two separators and a fixture name's `/`, all of which a fragment carries as they are.
    for (const { name, fragment } of addresses) {
      expect(fragment, name).toMatch(/^[A-Za-z0-9_~./-]+$/u);
    }
  });

  it("compresses, and by a lot", async () => {
    const packed = addresses.filter(({ name, fragment }) => fragment.slice(name.length).startsWith("~"));
    expect(packed.length).toBeGreaterThan(corpus.length * 0.9);

    const total = addresses.reduce((sum, { fragment }) => sum + fragment.length, 0);
    const raw = corpus.reduce((sum, { name, source }) => sum + name.length + 1 + Math.ceil(source.length / 3) * 4, 0);
    // Measured at 35 % less; the floor is low on purpose, the exact ratio depending on zlib's settings.
    expect(total).toBeLessThan(raw * 0.75);
  });

  it("leaves the source in RAW base64 when compressing would lengthen it", async () => {
    const fragment = await written(undefined, "graph LR\n");
    expect(fragment.startsWith("_")).toBe(true);
    expect(await read(fragment)).toEqual({ name: undefined, source: "graph LR\n" });
  });

  it("keeps a byte order mark and a composed emoji", async () => {
    const cases = [
      { what: "byte order mark", text: "﻿graph LR\n    A --> B\n" },
      { what: "ZWJ emoji", text: 'graph LR\n    A["\u{1f468}‍\u{1f469}‍\u{1f467}"] --> B\n' },
      { what: "ideographs", text: 'graph LR\n    A["寽対寿"] --> B\n' },
      { what: "empty source", text: "" },
    ];
    for (const { what, text } of cases) {
      expect((await read(await written(undefined, text))).source, what).toBe(text);
    }
  });

  it("splits at the FIRST separator, not the last one the base64 code will carry", async () => {
    // A name carrying a separator comes out cut, which is accepted: no fixture has one, the code has `_` everywhere.
    expect((await read(await written("a_name", "graph LR\n"))).name).toBe("a");

    const carriers = addresses.filter(({ name, fragment }) => fragment.slice(name.length + 1).includes("_"));
    expect(carriers.length).toBeGreaterThan(0);
    for (const { name, source, fragment } of carriers) expect(await read(fragment), name).toEqual({ name, source });
  });

  it("reopens an older address that only carried the name", async () => {
    expect(await read("subgraph-lr")).toEqual({ name: "subgraph-lr", source: undefined });
    expect(await read("")).toEqual({ name: undefined, source: undefined });
  });

  it("reads an older address that carried its source in raw base64", async () => {
    expect(await read("minimal_Z3JhcGggTFIKICAgIEEgLS0-IEIK")).toEqual({
      name: "minimal",
      source: "graph LR\n    A --> B\n",
    });
  });

  it("keeps the name of an address whose code was damaged on the way", async () => {
    const whole = await written("flowchart/subgraph-lr", corpus.find((one) => one.name === "flowchart/subgraph-lr")?.source ?? "");
    expect(await read(whole.slice(0, whole.length - 20))).toEqual({ name: "flowchart/subgraph-lr", source: undefined });
    expect((await read("subgraph-lr~@@@@")).source).toBeUndefined();
    expect((await read("subgraph-lr_@@@@")).source).toBeUndefined();
  });

  it("reads a link that unpacks past the size cap as damaged, and fast", async () => {
    // 388 KB of deflate expanding to 200 MB froze the viewer's tab for over a minute.
    const bomb = zlib.deflateRawSync(Buffer.from(`graph TD\n${"%% c\n".repeat(40_000_000)}`), { level: 9 });
    const started = performance.now();
    expect(await read(`bomb~${bomb.toString("base64url")}`)).toEqual({ name: "bomb", source: undefined });
    expect(performance.now() - started).toBeLessThan(500);

    const wide = Buffer.alloc(1_500_000, "a").toString("base64url");
    expect(await read(`wide_${wide}`)).toEqual({ name: "wide", source: undefined });
  });
});
