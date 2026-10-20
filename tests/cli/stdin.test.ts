import { describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { NEWLINE } from "../../src/text/chars.js";

const MAIN = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "cli", "main.ts");
// Longer than the CLI takes to start, so it is already reading when the next chunk is still to come.
const PAUSE_MS = 1500;

interface Run {
  readonly code: number | undefined;
  readonly stdout: string;
  readonly stderr: string;
}

// The CLI fed through a real pipe, a pause between chunks, as a slow writer or a network stream does.
async function piped(chunks: readonly string[]): Promise<Run> {
  const child = spawn(process.execPath, ["--import", "tsx", MAIN], { env: { ...process.env, NO_COLOR: "1" } });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (data) => (stdout += String(data)));
  child.stderr.on("data", (data) => (stderr += String(data)));
  const closed = new Promise<number | undefined>((resolve) => child.on("close", (code) => resolve(code ?? undefined)));
  for (const [i, chunk] of chunks.entries()) {
    if (i > 0) await sleep(PAUSE_MS);
    child.stdin.write(chunk);
  }
  child.stdin.end();
  return { code: await closed, stdout, stderr };
}

describe("a source piped on stdin", () => {
  it("is read whole from a writer slower than the reader", async () => {
    const run = await piped([`graph LR${NEWLINE}`, `  A-->B${NEWLINE}`]);
    expect(run.stderr).toBe("");
    expect(run.code).toBe(0);
    expect(run.stdout).toContain("A");
    expect(run.stdout).toContain("B");
  }, 20_000);

  it("is read whole past the pipe buffer", async () => {
    const padding = `%% ${"x".repeat(1000)}${NEWLINE}`.repeat(100);
    const run = await piped([`graph LR${NEWLINE}${padding}`, `  A-->B${NEWLINE}`]);
    expect(run.stderr).toBe("");
    expect(run.code).toBe(0);
    expect(run.stdout).toContain("B");
  }, 20_000);
});
