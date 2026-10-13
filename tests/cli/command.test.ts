import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { render } from "../../src/index.js";
import { NEWLINE } from "../../src/text/chars.js";
import { UsageError, parseArgs } from "../../src/cli/args.js";
import { HELP } from "../../src/cli/help.js";
import { OK } from "../../src/cli/exits.js";
import { main } from "../../src/cli/cli.js";
import { applyShowIds } from "../../src/cli/source.js";
import { TWO_PANES } from "../support/drawn.js";

const CLI_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "cli");

afterEach(() => {
  vi.restoreAllMocks();
});

describe("--help and --version", () => {
  it("come back from the parser as a marker, nothing printed, the process left running", () => {
    const exit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit was called");
    });
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    expect(parseArgs(["--help"])).toEqual({ shown: "help" });
    expect(parseArgs(["-h"])).toEqual({ shown: "help" });
    expect(parseArgs(["--version"])).toEqual({ shown: "version" });
    expect(exit).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it("are printed by the command, which then returns OK", async () => {
    const exit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit was called");
    });
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });
    expect(await main(["--help"])).toBe(OK);
    expect(written.join("")).toContain(HELP);
    written.length = 0;
    expect(await main(["--version"])).toBe(OK);
    expect(written.join("")).toMatch(/^mermaid2term \d+\.\d+\.\d+/u);
    expect(exit).not.toHaveBeenCalled();
  });

  it("leave no process.exit anywhere in the CLI, so a pipe gets its tail", () => {
    for (const name of fs.readdirSync(CLI_DIR)) {
      const text = fs.readFileSync(path.join(CLI_DIR, name), "utf8");
      expect(text, name).not.toContain("process.exit(");
    }
  });
});

describe("--tui", () => {
  it("is an unknown flag like any other, and the help does not mention it", () => {
    expect(() => parseArgs(["--tui"])).toThrow(UsageError);
    expect(HELP).not.toMatch(/tui/iu);
  });
});

describe("--show-ids", () => {
  const withIds = (direction: string, ...preamble: string[]): string =>
    applyShowIds([...preamble, `flowchart ${direction}`, "  A[Start] --> B[End]"].join(NEWLINE));

  it.each(["LR", "TD"])("lands its id lines after the header, past a frontmatter block (%s)", (direction) => {
    const shown = withIds(direction, "---", "title: Trip", "---");
    expect(shown.startsWith(["---", "title: Trip", "---", `flowchart ${direction}`, "  A["].join(NEWLINE))).toBe(true);
    const drawn = render(shown);
    expect(drawn).toContain("Trip");
    expect(drawn).toContain("A: Start");
    expect(drawn).toContain("B: End");
  });

  it.each(["LR", "TD"])("lands its id lines after the header, past leading comments (%s)", (direction) => {
    const shown = withIds(direction, "%% a note", "");
    expect(shown.startsWith(["%% a note", "", `flowchart ${direction}`, "  A["].join(NEWLINE))).toBe(true);
    expect(render(shown)).toContain("A: Start");
  });

  it("still lands them after a bare header", () => {
    const shown = withIds("LR");
    expect(shown.startsWith(["flowchart LR", "  A["].join(NEWLINE))).toBe(true);
    expect(render(shown)).toContain("A: Start");
  });

  const MINDMAP = ["mindmap", "  root((Root))", "    a[A]", "      Plain", '    b("Quoted")', '    c["`**md** text`"]'].join(NEWLINE);

  it.each(TWO_PANES)("writes a mindmap node's id into its own label, the tree drawn once (width %i)", (width) => {
    const drawn = render(applyShowIds(MINDMAP), { width });
    for (const label of ["root: Root", "a: A", "b: Quoted", "c: md text"]) expect(drawn).toContain(label);
    expect(drawn.split("Plain")).toHaveLength(2);
    expect(drawn.split("Root")).toHaveLength(2);
    expect(drawn).not.toMatch(/"/u);
  });
});
