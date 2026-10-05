import { describe, expect, it } from "vitest";

import { render, renderThemed } from "../../src/index.js";
import { richSegments, plainOf } from "../../src/source/markdown.js";
import { SGR_RE } from "../support/ansi.js";

// The row is found on the PLAIN drawing and read on the painted one: a marked piece is its own run, so the word
// a reader sees whole is split by escapes in the painted row and `includes` would never find it there.
const inkOn = (source: string, width: number, word: string): string[] => {
  const at = render(source, { width }).split("\n").findIndex((one) => one.includes(word));
  const row = renderThemed(source, { width }, "classic").split("\n")[at] ?? "";
  return [...row.matchAll(SGR_RE)].flatMap((found) => found[1].split(";"));
};
const BOLD = "1";
const ITALIC = "3";

// mermaid hands these labels to `createText` with its `markdown` option left at the default, which is TRUE, so
// the text is read as markdown whether or not it wears the backticks of a markdown string. A terminal has an
// ink for bold and one for italic, so both come out; every other markdown node has nothing to be drawn with.
describe("the one reading of a rich label, where mermaid marks a label `labelType: \"markdown\"`", () => {
  it("reads the three spellings and nothing else", () => {
    expect(plainOf("**bold** and _it_")).toBe("bold and it");
    expect(plainOf("<b>bold</b> and <i>it</i>")).toBe("bold and it");
    expect(plainOf('"`**bold**`"')).toBe("bold");
    // The fence with its quotes already taken off, which is how some parsers hand the label over.
    expect(plainOf("`**bold**`")).toBe("bold");
    // Nothing marked is nothing to paint, so the caller keeps its plain path.
    expect(richSegments("plain text")).toBeUndefined();
    expect(richSegments("snake_case_name")).toBeUndefined();
    expect(richSegments("string *id")).toBeUndefined();
  });

  it("dresses a class label, a member and a note", () => {
    const source = 'classDiagram\n    class A["**Bold** name"] {\n        +**b**Field\n        +m() _it_\n    }\n    note for A "a **bold** note"\n';
    const drawn = render(source, { width: 70 });
    expect(drawn).toContain("Bold name");
    expect(drawn).toContain("+bField");
    expect(drawn).toContain("+m() : it");
    expect(drawn).toContain("a bold note");
    expect(drawn).not.toMatch(/\*\*|__/u);
    expect(inkOn(source, 70, "Bold name")).toContain(BOLD);
    expect(inkOn(source, 70, "+bField")).toContain(BOLD);
    expect(inkOn(source, 70, "+m() : it")).toContain(ITALIC);
    expect(inkOn(source, 70, "a bold note")).toContain(BOLD);
    // A row with nothing marked wears neither, so the ink is the word's and never the row's.
    expect(inkOn('classDiagram\n    class A {\n        +plainField\n    }\n', 70, "+plainField")).not.toContain(BOLD);
  });

  it("keeps the box as wide as the letters, never as wide as the markers", () => {
    const rich = render('classDiagram\n    class A["**Bold** name"]\n', { width: 70 });
    const plain = render('classDiagram\n    class A["Bold name"]\n', { width: 70 });
    expect(rich).toBe(plain);
  });

  it("dresses an entity's name, its alias and every cell of its rows", () => {
    const source = 'erDiagram\n    p["**Person** ledger"] {\n        string _name_\n        string id PK "the **key**"\n    }\n    p ||--o{ B : x\n';
    const drawn = render(source, { width: 70 });
    expect(drawn).toContain("Person ledger");
    expect(drawn).toContain("name");
    expect(drawn).toContain("the key");
    expect(drawn).not.toContain('"');
    expect(drawn).not.toMatch(/\*\*/u);
    expect(inkOn(source, 70, "Person ledger")).toContain(BOLD);
    expect(inkOn(source, 70, "the key")).toContain(BOLD);
    expect(inkOn(source, 70, "string | name")).toContain(ITALIC);
    // A quoted name was the one place this already read, and it reads the same through the shared path.
    expect(render('erDiagram\n    "This **is** _Markdown_" ||--|| B : x\n', { width: 70 })).toContain("This is Markdown");
  });

  it("dresses a state and a note of its own", () => {
    const source = "stateDiagram-v2\n    s1 : a **bold** state\n    note right of s1 : an _italic_ note\n";
    const drawn = render(source, { width: 70 });
    expect(drawn).toContain("a bold state");
    expect(drawn).toContain("an italic note");
    expect(inkOn(source, 70, "a bold state")).toContain(BOLD);
    expect(inkOn(source, 70, "an italic note")).toContain(ITALIC);
  });

  // Measured on mermaid 12 headless (2026-09-29): a class relation's label and an entity relationship's are
  // markdown, `**md**` coming out bold, while a backtick fence stays the text it is, backticks and all.
  const relationInked = (source: string): void => {
    const drawn = render(source, { width: 80 });
    expect(drawn).toContain("a md b");
    expect(drawn).not.toContain("**");
    expect(inkOn(source, 80, "a md b")).toContain(BOLD);
  };

  it("dresses a class relation's label, a fenced one kept as text", () => {
    for (const direction of ["TB", "LR"]) {
      relationInked(`classDiagram\n    direction ${direction}\n    A --> F : a **md** b\n`);
      expect(render(`classDiagram\n    direction ${direction}\n    A --> F : \`**md**\`\n`, { width: 80 })).toContain("`**md**`");
    }
  });

  // Each row of a broken label is read on its own, so the weight stays on the row that asked for it.
  it("keeps a relation label's rows and each row's weight together", () => {
    for (const direction of ["TB", "LR"]) {
      const source = `classDiagram\n    direction ${direction}\n    A --> B : **bold**<br>plain\n`;
      const drawn = render(source, { width: 80 });
      expect(drawn).not.toContain("**");
      const rows = drawn.split("\n");
      expect(rows.findIndex((row) => row.includes("plain"))).toBe(rows.findIndex((row) => row.includes("bold")) + 1);
      expect(inkOn(source, 80, "bold")).toContain(BOLD);
      expect(inkOn(source, 80, "plain")).not.toContain(BOLD);
    }
  });

  it("dresses an entity relationship's label, a fenced one kept as text", () => {
    for (const direction of ["TB", "LR"]) {
      relationInked(`erDiagram\n    direction ${direction}\n    A ||--|| F : "a **md** b"\n`);
      relationInked(`erDiagram\n    direction ${direction}\n    A ||--|| A : "a **md** b"\n`);
      expect(render(`erDiagram\n    direction ${direction}\n    A ||--|| F : "\`**md**\`"\n`, { width: 80 })).toContain("`**md**`");
      const broken = `erDiagram\n    direction ${direction}\n    A ||--|| B : "**bold**<br>plain"\n`;
      const rows = render(broken, { width: 80 }).split("\n");
      expect(rows.findIndex((row) => row.includes("plain"))).toBe(rows.findIndex((row) => row.includes("bold")) + 1);
      expect(inkOn(broken, 80, "bold")).toContain(BOLD);
      expect(inkOn(broken, 80, "plain")).not.toContain(BOLD);
    }
  });

  // The ground belongs to the KEY the caller draws under, so swapping a marked run's key for a bare `bold_label`
  // left it on the page's own ground: the note's yellow stopped behind the word it was meant to carry.
  it("keeps the ground of the box behind a word the markdown marks", () => {
    const source = 'classDiagram\n    class L\n    note for L "posts are **final**"\n';
    const painted = renderThemed(source, { width: 60 }, "classic");
    const row = painted.split("\n").find((one) => one.includes("posts")) ?? "";
    const grounds = [...row.matchAll(SGR_RE)].map((found) => found[1]).filter((codes) => codes.includes("48;2;"));
    // Every painted run of the row wears the same ground, the marked one included.
    expect(new Set(grounds.map((codes) => codes.slice(codes.indexOf("48;2;")))).size).toBe(1);
    expect(grounds.some((codes) => codes.startsWith("1;"))).toBe(true);
  });

  // The flowchart takes its type from the lexer, `labelType` being "markdown" only for a `"\`...\`"` label, so a
  // bare `**x**` there is the text it is written as. mermaid makes the distinction, so this keeps it.
  it("leaves a flowchart label alone unless it wears the backticks", () => {
    const drawn = render('flowchart LR\n    A["**not bold**"] --> B["`**bold**`"]\n', { width: 70 });
    expect(drawn).toContain("**not bold**");
    expect(drawn).toContain("bold");
  });
});
