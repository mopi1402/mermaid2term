import * as fs from "node:fs";
import * as tty from "node:tty";
import { CHANNEL_MAX, HEX_BASE, HEX_RE, formatHex } from "../colour/rgb.js";
import { OSC11_QUERY, OSC11_REPLY_RE } from "../paint/escapes.js";

const XCOLOR_RE = /^rgb:([0-9a-f]{1,4})\/([0-9a-f]{1,4})\/([0-9a-f]{1,4})$/iu;

const TTY_PATH = "/dev/tty";
const DEFAULT_TIMEOUT_MS = 100;

const channel = (digits: string): number => {
  const top = HEX_BASE ** digits.length - 1;
  return Math.round((Number.parseInt(digits, HEX_BASE) / top) * CHANNEL_MAX);
};

export function parseXColor(spec: string): string | undefined {
  if (HEX_RE.test(spec)) return spec.toUpperCase();
  const found = XCOLOR_RE.exec(spec) ?? undefined;
  if (found === undefined) return undefined;
  return formatHex({ r: channel(found[1]), g: channel(found[2]), b: channel(found[3]) });
}

export function parseOsc11(reply: string): string | undefined {
  const found = OSC11_REPLY_RE.exec(reply) ?? undefined;
  return found === undefined ? undefined : parseXColor(found[1]);
}

export { backgroundFromColorFgBg } from "../paint/environment.js";

export interface BackgroundProbe {
  readonly reply: string | undefined;
  readonly colour: string | undefined;
  readonly elapsedMs: number;
  readonly failure: "no-tty" | "raw-mode" | "write" | "timeout" | undefined;
}

export function probeTerminalBackground(timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<BackgroundProbe> {
  const started = performance.now();
  return new Promise((resolve) => {
    let fd: number;
    try {
      fd = fs.openSync(TTY_PATH, "r+");
    } catch {
      resolve({ reply: undefined, colour: undefined, elapsedMs: 0, failure: "no-tty" });
      return;
    }
    const stream = new tty.ReadStream(fd);
    let reply = "";
    let settled = false;
    const finish = (colour: string | undefined, failure: BackgroundProbe["failure"]): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        stream.setRawMode(false);
      } catch {
      }
      stream.destroy();
      resolve({ reply: reply === "" ? undefined : reply, colour, elapsedMs: performance.now() - started, failure });
    };
    const timer = setTimeout(() => finish(undefined, "timeout"), timeoutMs);
    try {
      stream.setRawMode(true);
    } catch {
      finish(undefined, "raw-mode");
      return;
    }
    stream.on("data", (chunk: Buffer) => {
      reply += chunk.toString("latin1");
      const colour = parseOsc11(reply);
      if (colour !== undefined) finish(colour, undefined);
    });
    stream.on("error", () => finish(undefined, "write"));
    try {
      fs.writeSync(fd, OSC11_QUERY);
    } catch {
      finish(undefined, "write");
    }
  });
}

export async function queryTerminalBackground(timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<string | undefined> {
  return (await probeTerminalBackground(timeoutMs)).colour;
}
