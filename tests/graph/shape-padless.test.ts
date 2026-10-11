import { describe, it, expect } from "vitest";
import { render, renderThemed } from "../../src/index.js";
import { must } from "../../src/must.js";

describe("`borders: padless`, a rectangle's border moved to the inner edge of its cells", () => {
  const padless = (source: string, options = {}): string => render(source, { width: 80, borders: "padless", ...options });

  it("draws a box attached above and below VERTICAL: the rules on the far edge of its frame rows, the walls hugging the name, no frame row spent", () => {
    const rows = padless("flowchart TD\n    A[Start] --> B[Decision]").split("\n");
    expect(rows[0]).toMatch(/^▕▔+▏$/u);
    expect(rows[1]).toMatch(/^▕\s+Start\s+▏$/u);
    expect(rows[2]).toMatch(/^▕▁+▏$/u);
    expect(rows[3]).toMatch(/^\s+│$/u);
    expect(rows[4]).toMatch(/^\s+⏷$/u);
    expect(rows[5]).toMatch(/^▕▔+▏$/u);
    expect(rows[6]).toMatch(/^▕\s+Decision\s+▏$/u);
    expect(rows).toHaveLength(8);
    expect(rows.join("\n")).not.toMatch(/[┌┐└┘┬┴]/u);
  });

  it("reads a HEAVY border into FULL blocks down the page and HALF blocks across it, the fill behind the halves", () => {
    const rows = padless("flowchart TD\n    A[Start] --> B[Next]\n    style A stroke-width:4px").split("\n");
    expect(rows[0]).toMatch(/^█▀+█$/u);
    expect(rows[1]).toMatch(/^█\s+Start\s+█$/u);
    expect(rows[2]).toMatch(/^█▄+█$/u);
    const across = padless("flowchart LR\n    A[Start] --> B[Next]\n    style A stroke-width:4px").split("\n");
    expect(across[0]).toMatch(/^▄+\s+▁+$/u);
    expect(across[2]).toMatch(/^▌\s+Start\s+▐─+⏵▏\s+Next\s+▕$/u);
    expect(across[4]).toMatch(/^▀+\s+▔+$/u);
  });

  it("corners a ROUNDED box with the quadrant arcs, the curve that sits in the cell's own corner", () => {
    const rows = padless("flowchart LR\n    A(Round)").split("\n");
    expect(rows[0]).toMatch(/^◜▔+◝$/u);
    expect(rows.find((row) => row.includes("Round"))).toMatch(/^▏\s+Round\s+▕$/u);
    expect(must(rows.at(-1))).toMatch(/^◟▁+◞$/u);
    expect(rows.join("\n")).not.toMatch(/[▝▘]/u);
  });

  it("keeps a TALL rounded box the size of the rectangle beside it, the arcs a row inside the rules ACROSS the page", () => {
    const rows = padless("flowchart LR\n    A[Rectangle] --> B(Rounded)").split("\n");
    expect(rows[0]).toBe("▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁     ▁▁▁▁▁▁▁▁▁▁▁");
    expect(rows[1]).toBe("▏             ▕    ◜           ◝");
    expect(rows[2]).toBe("▏  Rectangle  ▕───⏵▏  Rounded  ▕");
    expect(rows[3]).toBe("▏             ▕    ◟           ◞");
    expect(rows[4]).toBe("▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔     ▔▔▔▔▔▔▔▔▔▔▔");
  });

  it("corners a tall rounded box DOWN the page in the rule row itself, where its wall runs the whole height", () => {
    const rows = padless("flowchart TD\n    A[Rect] --> B(\"Rounded<br>Text\")").split("\n");
    expect(rows[5]).toBe("◜▔▔▔▔▔▔▔▔▔▔▔◝");
    expect(rows[6]).toBe("▏  Rounded  ▕");
    expect(rows[7]).toBe("▏   Text    ▕");
    expect(rows[8]).toBe("◟▁▁▁▁▁▁▁▁▁▁▁◞");
  });

  it("draws a sequence `box` as the container a subgraph is drawn as, its title INSIDE and not on the rule", () => {
    const source =
      "sequenceDiagram\n    box Purple Front\n    participant C as Client\n    participant P as PO\n    end\n    C->>P: ping";
    const rows = padless(source, { width: 46 }).split("\n");
    expect(rows[0]).toMatch(/^▁+$/u);
    expect(rows[1]).toMatch(/^▏\s+Front\s+▕$/u);
    // A blank row under the name, as a `title` statement leaves: pressed against the heads it reads as one of them.
    expect(rows[2]).toMatch(/^▏\s+▕$/u);
    expect(rows[3]).toMatch(/^▏\s*▕▔+▏.+▏\s*▕$/u);
    expect(must(rows[rows.length - 1])).toMatch(/^▔+$/u);
    expect(rows.join("\n")).not.toMatch(/[╔╗╚╝║═]/u);
    // The default borders keep mermaid's own frame, the title written on its top rule.
    expect(render(source, { width: 46 })).toMatch(/╔═+ Front ═+╗/u);
  });

  it("never cuts a NOTE with a box's outline, the blank cells a note holds being the note's own", () => {
    const rows = padless(
      "sequenceDiagram\n    box Purple Front\n    participant C as Client\n    participant P as PO\n    end\n" +
        "    participant D as Dev\n    C->>P: ping\n    Note over P,D: Status check",
      { width: 60 }
    ).split("\n");
    const note = must(rows.find((row) => row.includes("Status check")));
    const at = note.indexOf("Status check");
    const opened = note.lastIndexOf("▏", at);
    const closed = note.indexOf("▕", at);
    expect(opened).toBeGreaterThan(0);
    expect(closed).toBeGreaterThan(at);
    expect(note.slice(opened + 1, closed)).not.toMatch(/[▏▕]/u);
    // The wall the note covered stands on the row above, so the notch is the frame's and not a missing wall.
    expect(must(rows[rows.indexOf(note) - 1]).slice(opened + 1, closed)).toContain("▕");
  });

  it("stops a box's FILL at the frame, a padless rule leaving the rest of its row outside the line", () => {
    const source =
      "sequenceDiagram\n    box Purple Front\n    participant C as Client\n    participant P as PO\n    end\n    C->>P: ping";
    const purple = "48;2;128;0;128";
    const painted = renderThemed(source, { width: 46, borders: "padless", background: "dark" }, "default")
      .split("\n")
      .filter((row) => row !== "");
    expect(must(painted[0])).not.toContain(purple);
    expect(must(painted[painted.length - 1])).not.toContain(purple);
    // A wall rides the outer edge of its column, so the fill runs under it, up to the line.
    expect(must(painted[1])).toMatch(new RegExp(`38;2;\\d+;\\d+;\\d+;${purple}m▏`, "u"));
    // The default borders keep the fill under their own rule, mermaid's stroke sitting on the rect it fills.
    expect(must(renderThemed(source, { width: 46, background: "dark" }, "default").split("\n")[0])).toContain(purple);
  });

  it("inks a `box`'s frame, mermaid stroking it with the node border and a block glyph having no default ink to lean on", () => {
    const source =
      "sequenceDiagram\n    box Purple Front\n    participant C as Client\n    participant P as PO\n    end\n    C->>P: ping";
    const painted = renderThemed(source, { width: 46, borders: "padless", background: "dark" }, "default").split("\n");
    expect(must(painted[0])).toMatch(/38;2;\d+;\d+;\d+[\d;]*m▁+/u);
    expect(must(painted[1])).toMatch(/38;2;\d+;\d+;\d+[\d;]*m▏/u);
    // The same stroke under the default borders, where the rule is a line glyph.
    expect(renderThemed(source, { width: 46, background: "dark" }, "default")).toMatch(/38;2;\d+;\d+;\d+[\d;]*m╔/u);
  });

  it("spends the title's row only where a box carries one, an untitled box opening straight on the heads", () => {
    const rows = padless(
      "sequenceDiagram\n    box rgb(200,220,255)\n    participant C as Client\n    participant P as PO\n    end\n    C->>P: ping",
      { width: 46 }
    ).split("\n");
    expect(rows[0]).toMatch(/^▁+$/u);
    expect(rows[1]).toMatch(/^▏\s*▕▔+▏.+▏\s*▕$/u);
  });

  it("squares a SEQUENCE actor box, where the rounded corner would stand a cell away from a border on the edges", () => {
    const rows = padless("sequenceDiagram\n    participant Client\n    participant API\n    Client->>API: GET").split("\n");
    expect(rows[0]).toMatch(/^▕▔+▏\s+▕▔+▏$/u);
    expect(rows[1]).toMatch(/^▕\s+Client\s+▏\s+▕\s+API\s+▏$/u);
    expect(rows[2]).toMatch(/^▕▁+▏\s+▕▁+▏$/u);
    expect(rows.join("\n")).not.toMatch(/[╭╮╰╯]/u);
    // The default borders keep the rounded corner: the square one is the padless mode's alone.
    expect(render("sequenceDiagram\n    participant Client", { width: 80 })).toMatch(/╭/u);
  });

  it("spends NO row on a sequence note's frame: one line of text stands one line tall, walls on its own cells", () => {
    const rows = padless(
      "sequenceDiagram\n    participant A\n    participant B\n    Note left of A: left\n    A->>B: go\n    Note over A,B: over one<br>two lines"
    ).split("\n");
    expect(rows.filter((line) => /▏\s+left\s+▕/u.test(line))).toHaveLength(1);
    expect(rows.filter((line) => /▏[^▕]*over one[^▕]*▕|▏[^▕]*two lines[^▕]*▕/u.test(line))).toHaveLength(2);
    // No rule row above or below either note, and the actor boxes above still carry theirs.
    expect(rows.join("\n")).not.toMatch(/[┌┐└┘]/u);
    expect(rows.filter((line) => /▔/u.test(line))).toHaveLength(1);
  });

  it("gives a STADIUM eighths two columns short of its walls, shoulders a column inside them, and keeps its parens", () => {
    const rows = padless("flowchart TD\n    A([Stadium]) --> B([Next])").split("\n");
    expect(rows[0]).toMatch(/^\s+▁+$/u);
    expect(rows[1]).toMatch(/^\s▟\s+▙$/u);
    expect(rows[2]).toMatch(/^\(\s+Stadium\s+\)$/u);
    expect(rows[3]).toMatch(/^\s▜\s+▛$/u);
    expect(rows[4]).toMatch(/^\s+▔+│▔+$/u);
    expect(rows[0].indexOf("▁")).toBe(2);
    expect(rows.join("\n")).not.toMatch(/[╭╮╰╯█]/u);
    const drawn = renderThemed("flowchart LR\n    A([Pill])", { width: 80, borders: "padless", background: "light" }, "default");
    expect(drawn).toContain("38;2;236;236;255m▟");
    expect(drawn).toContain("38;2;147;112;219m▁");
    expect(drawn).toContain("38;2;147;112;219;48;2;236;236;255m(");
  });

  it("moves a LINED rectangle's bar the same way, on its left alone", () => {
    const rows = padless("flowchart LR\n    A@{ shape: lin-rect, label: \"Lined\" }").split("\n");
    expect(rows[1]).toMatch(/^▕▕\s+▏$/u);
    expect(rows[2]).toMatch(/^▕▕\s+Lined\s+▏$/u);
  });

  it("moves a SUBROUTINE's inner lines to the edge facing the frame, the fill behind them", () => {
    const rows = padless("flowchart LR\n    A[[Subroutine]]").split("\n");
    expect(rows[0]).toMatch(/^ ▁+$/u);
    expect(rows[1]).toMatch(/^ ▏▏\s+▕▕$/u);
    expect(rows[2]).toMatch(/^ ▏▏\s+Subroutine\s+▕▕$/u);
    const drawn = renderThemed("flowchart LR\n    A[[Sub]]", { width: 80, borders: "padless", background: "light" }, "default");
    expect(drawn).toContain(" \u001b[38;2;147;112;219;48;2;236;236;255m▏▏");
  });

  it("says a CIRCLE with a `⭘` either side of its NAME, its rules plain eighths", () => {
    const rows = padless("flowchart LR\n    A((Circle))").split("\n");
    expect(rows[0]).toMatch(/^▕▔+▏$/u);
    expect(rows[1]).toMatch(/^▕ ⭘ Circle ⭘ ▏$/u);
    expect(rows[2]).toMatch(/^▕▁+▏$/u);
    expect(rows.join("\n")).not.toContain("◯");
    const drawn = renderThemed("flowchart LR\n    A((Circle))", { width: 80, borders: "padless", background: "light" }, "default");
    expect(drawn).toContain("38;2;147;112;219;48;2;236;236;255m⭘");
  });

  it("says a DOUBLE circle with a `◎` either side of its name the same way", () => {
    const rows = padless("flowchart LR\n    A(((Double circle)))").split("\n");
    expect(rows[0]).toMatch(/^▕▔+▏$/u);
    expect(rows[1]).toMatch(/^▕ ◎ Double circle ◎ ▏$/u);
    expect(rows[2]).toMatch(/^▕▁+▏$/u);
  });

  it("says a RHOMBUS with a `◆` either side of its name, its `◇` gone from the rules", () => {
    const rows = padless("flowchart LR\n    A{Rhombus}").split("\n");
    expect(rows[0]).toMatch(/^▕▔+▏$/u);
    expect(rows[1]).toMatch(/^▕ ◆ Rhombus ◆ ▏$/u);
    expect(rows[2]).toMatch(/^▕▁+▏$/u);
    expect(rows.join("\n")).not.toContain("◇");
  });

  it("moves a SHEARED shape's flats to the inner edge of their row, each running between the slopes beside it", () => {
    const rows = padless("flowchart LR\n    A[/Para/] --> B[\\Alt\\] --> C[/Trap\\] --> D[\\Inv/]").split("\n");
    const para = rows[1].indexOf("╱");
    expect(rows[0].indexOf("▁")).toBe(para + 1);
    expect(rows[4].indexOf("▔")).toBe(rows[3].indexOf("╱"));
    const alt = rows[1].indexOf("╲");
    expect(rows[0].indexOf("▁", para + 1) === alt || rows[0].slice(alt, alt + 1) === "▁").toBe(true);
    expect(rows[0]).toMatch(/^\s+▁+\s+▁+\s+▁+\s+▁+$/u);
    expect(rows[4]).toMatch(/^\s+▔+\s+▔+\s+▔+\s+▔+$/u);
    expect(rows[1]).toMatch(/^\s+╱\s+╱\s+╲\s+╲\s+╱\s+╲\s+╲\s+╱$/u);
    expect(rows.join("\n")).not.toMatch(/[╱╲]▁|▁[╱╲]|[╱╲]▔|▔[╱╲]/u);
  });

  it("closes a BRACE on the name, a hook over it and one under, the stems of the padding gone", () => {
    const rows = padless("flowchart LR\n    A@{ shape: comment, label: \"Comment\" } --> B@{ shape: braces, label: \"Two<br>lines\" }").split("\n");
    const nib = rows.findIndex((row) => row.includes("Comment"));
    expect(rows[nib]).toMatch(/^⎨\s+Comment\s+─+⏵⎨\s+lines\s+⎬$/u);
    expect(rows[nib - 1]).toMatch(/^⎧\s+⎪\s+Two\s+⎪$/u);
    expect(rows[nib + 1]).toMatch(/^⎩\s+⎩\s+⎭$/u);
    expect(rows[nib - 2]).toMatch(/^\s+⎧\s+⎫$/u);
    expect(rows.filter((row) => row.startsWith("⎪"))).toHaveLength(0);
  });

  it("moves a DIVIDED rectangle's band rule to the floor of its row, the walls where the tees stood, the fill behind", () => {
    const rows = padless("flowchart LR\n    A@{ shape: div-rect, label: \"Divided\" }").split("\n");
    expect(rows[0]).toMatch(/^ ▁+$/u);
    expect(rows[1]).toMatch(/^▕▁+▏$/u);
    expect(rows[2]).toMatch(/^▕\s+Divided\s+▏$/u);
    const drawn = renderThemed("flowchart LR\n    A@{ shape: div-rect, label: \"Divided\" }", { width: 80, borders: "padless", background: "light" }, "default");
    expect(drawn).toContain("38;2;147;112;219;48;2;236;236;255m▁▁");
  });

  it("runs an ASYMMETRIC node's rules to its notched edge and draws the notch in box-drawing slopes", () => {
    const rows = padless("flowchart LR\n    A>Asymmetric] --> B[Box]").split("\n");
    expect(rows[0]).toMatch(/^▁+\s+▁+$/u);
    expect(rows[1]).toMatch(/^╲\s+▕\s+▏\s+▕$/u);
    expect(rows[2]).toMatch(/^ ⟩\s+Asymmetric ▕─+⏵▏\s+Box\s+▕$/u);
    expect(rows[3]).toMatch(/^╱\s+▕\s+▏\s+▕$/u);
    expect(rows[4]).toMatch(/^▔+\s+▔+$/u);
  });

  it("keeps the stroke's own colour, the key untouched, and moves nothing under `default`", () => {
    const source = "flowchart LR\n    A[Left] --> B[Right]\n    style A stroke:#f00";
    const drawn = renderThemed(source, { width: 80, borders: "padless", background: "light" }, "default");
    expect(drawn).toContain("38;2;255;0;0m▁");
    expect(drawn).toContain("38;2;255;0;0;48;2;236;236;255m▕");
    expect(drawn).toContain("38;2;147;112;219;48;2;236;236;255m▏");
    expect(render(source, { width: 80, borders: "default" })).toBe(render(source, { width: 80 }));
  });

  it("draws a chain HORIZONTAL, the walls on the far edge of their cells and the rules in the frame rows, no wall retreating", () => {
    const rows = padless("flowchart LR\n    A[A] --> B[B] --- C[C] -.-> D[D] ==> E[E]").split("\n");
    expect(rows[0]).toBe("▁▁▁▁▁▁▁    ▁▁▁▁▁▁▁   ▁▁▁▁▁▁▁    ▁▁▁▁▁▁▁    ▁▁▁▁▁▁▁");
    expect(rows[1]).toBe("▏     ▕    ▏     ▕   ▏     ▕    ▏     ▕    ▏     ▕");
    expect(rows[2]).toBe("▏  A  ▕───⏵▏  B  ▕───▏  C  ▕┄┄┄⏵▏  D  ▕━━━⏵▏  E  ▕");
    expect(rows[3]).toBe("▏     ▕    ▏     ▕   ▏     ▕    ▏     ▕    ▏     ▕");
    expect(rows[4]).toBe("▔▔▔▔▔▔▔    ▔▔▔▔▔▔▔   ▔▔▔▔▔▔▔    ▔▔▔▔▔▔▔    ▔▔▔▔▔▔▔");
  });

  it("keeps a fan's walls whole, every head against the wall it arrives on and every stroke leaving from it", () => {
    const rows = padless("flowchart LR\n    A[A] --> B[B]\n    B --> C[C]\n    B --> D[D]\n    B ==> E[E]\n    B --> A").split("\n");
    const a = rows.findIndex((row) => row.includes(" A "));
    expect(rows[a - 1]).toBe("▏     ▕────⏵▏     ▕──╯    ▏     ▕");
    expect(rows[a]).toBe("▏  A  ▕     ▏  B  ▕──────⏵▏  D  ▕");
    expect(rows[a + 1]).toBe("▏     ▕⏴────▏     ▕━━┓    ▏     ▕");
  });

  it("keeps an edge as long as it is under `default`, the heads against the walls", () => {
    const source = "flowchart LR\n    A[A] <--> B[B] --> C[C] --- D[D]";
    const plain = render(source, { width: 80 }).split("\n")[2];
    const rows = padless(source).split("\n");
    expect(plain).toBe("│  A  │⏴───⏵│  B  ├───⏵│  C  ├───┤  D  │");
    expect(rows[2]).toBe("▏  A  ▕⏴───⏵▏  B  ▕───⏵▏  C  ▕───▏  D  ▕");
    const mixed = padless("flowchart LR\n    A[A] --> B([Stadium]) --> C[C]").split("\n");
    expect(mixed[2]).toMatch(/^▏  A  ▕─+⏵\(  Stadium  \)─+⏵▏  C  ▕$/u);
  });

  it("draws a vertical chain in three rows a box, heavy ones in full blocks, the heads in the gaps", () => {
    const rows = padless("flowchart TD\n    A[Start] --> B(Next)\n    B --> C[Third]\n    style A stroke-width:4px\n    style C stroke-width:4px").split("\n");
    expect(rows[0]).toBe("█▀▀▀▀▀▀▀▀▀█");
    expect(rows[1]).toBe("█  Start  █");
    expect(rows[2]).toBe("█▄▄▄▄▄▄▄▄▄█");
    expect(rows[3]).toBe("     │");
    expect(rows[4]).toBe("     ⏷");
    expect(rows[5]).toBe("◜▔▔▔▔▔▔▔▔▔◝");
    expect(rows[6]).toBe("▏  Next   ▕");
    expect(rows[7]).toBe("◟▁▁▁▁▁▁▁▁▁◞");
    expect(rows[9]).toBe("     ⏷");
    expect(rows[10]).toBe("█▀▀▀▀▀▀▀▀▀█");
    expect(rows).toHaveLength(13);
  });

  it("STEPS a padded shape's rule at the edge's column and leaves a tight shape's rules whole, both axes attached", () => {
    const rows = padless("flowchart TD\n    A[Rectangle] <==> B(Rounded)\n    B <==> C([Stadium])\n    C <==> D[[Subroutine]]\n    D <==> E[(Cylindrical)]\n    E <==> F((Circle))\n    B <==> E").split("\n");
    const sub = rows.findIndex((row) => row.includes("Subroutine"));
    expect(rows[sub - 2]).toBe(" ▁▁▁▁▁▁▁▁⏷▁▁▁▁▁▁▁  ┃          ⏷");
    expect(rows[sub - 1]).toBe(" ▏▏      ▔     ▕▕  ┃ ▕▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▏");
    expect(rows[sub]).toBe(" ▏▏ Subroutine ▕▕⏴━┛ ▕   ⭘ Circle ⭘   ▏");
    const round = rows.findIndex((row) => row.includes("Rounded"));
    expect(rows[round + 1]).toBe("            ◟▁▁▁▁▁▁▁▁▁▁▁▁▁◞");
    expect(rows[round + 2]).toBe("                ⏶     ⏶");
  });

  it("draws each box on the AXIS its edges use most: A HORIZONTAL for three edges on its walls, its targets VERTICAL", () => {
    const rows = padless("flowchart LR\n    A[A] --> B[B]\n    A --> C[Rectangle]\n    A --> D[D]\n    B --> C\n    D --> C").split("\n");
    // A closed-up SQUARE box inks the inner edge of its wall column, so the head takes that column and the wall steps
    // to the next cell's far edge, which is the same vertical line: the ink meets the head with no gap and no jog.
    expect(rows[7]).toBe("▁▁▁▁▁▁▁  │          ⏷");
    expect(rows[8]).toBe("▏     ▕──╯   ▕▔▔▔▔▔▔▔▔▔▔▔▔▔▏");
    expect(rows[9]).toBe("▏  A  ▕──────⏵▏ Rectangle  ▏");
    expect(rows[10]).toBe("▏     ▕──╮   ▕▁▁▁▁▁▁▁▁▁▁▁▁▁▏");
    expect(rows[1]).toBe("             ▕▔▔▔▔▔▔▔▔▔▔▔▔▔▏");
    expect(rows[2]).toBe("         ╭───⏵▏     B      ▏");
    expect(rows[3]).toBe("         │   ▕▁▁▁▁▁▁▁▁▁▁▁▁▁▏");
  });

  it("carries a heavy border's half blocks across the page, and a head onto the frame cell of a marked box", () => {
    const rows = padless("flowchart LR\n    A[Heavy] --> B[[Sub]] --> C[/Para/] --> D((Circ))\n    style A stroke-width:4px").split("\n");
    expect(rows[0]).toMatch(/^▄+\s+▁+/u);
    expect(rows[2]).toMatch(/^▌  Heavy  ▐─+⏵▏▏ Sub ▕▕─+⏵  ╱  Para  ╱ ─+⏵▏ ⭘ Circ ⭘ ▕$/u);
    expect(rows[4]).toMatch(/^▀+\s+▔+/u);
  });

  it("lets a DOTTED edge stay dotted up to the wall, and its head stand in the gap under a rule", () => {
    const rows = padless("flowchart LR\n    A[Rectangle] -.- B(Rounded) <-.-> C([Stadium])\n    C ==> D[Thick]").split("\n");
    expect(rows[2]).toBe("▏  Rectangle  ▕┄┄┄▏  Rounded  ▕⏴┄┄┄⏵(  Stadium  )━━━⏵▏  Thick  ▕");
    const down = padless("flowchart TD\n    A[Up] -.-> B[Down]").split("\n");
    expect(down[3]).toBe("     ┊");
    expect(down[4]).toBe("     ⏷");
  });

  it("draws a SUBROUTINE's inner lines against its walls, a head sticking to either side, its frame column kept where nothing is attached", () => {
    const rows = padless("flowchart LR\n    A[Box] --> B[[Subroutine]] --> C[Box]\n    D[[Alone]]").split("\n");
    expect(rows[2]).toBe("▏    Box    ▕───⏵▏▏ Subroutine ▕▕────⏵▏  Box  ▕");
    expect(rows[1]).toBe("▏           ▕    ▏▏            ▕▕     ▏       ▕");
    expect(rows[7]).toBe(" ▏▏       ▕▕");
    expect(rows[8]).toBe(" ▏▏ Alone ▕▕");
    expect(rows[6]).toBe(" ▁▁▁▁▁▁▁▁▁▁▁");
    const heavy = padless("flowchart LR\n    E[[Heavy]] --> F[Box]\n    style E stroke-width:4px").split("\n");
    expect(heavy[0]).toMatch(/^ ▙▄+▟\s/u);
    expect(heavy[2]).toMatch(/^ ▌▌ Heavy ▐▐─+⏵/u);
    expect(heavy[4]).toMatch(/^ ▛▀+▜\s/u);
  });

  it("redraws a CARD as a rectangle, its slope a column inside the wall and its top row the eighths it already wore", () => {
    const rows = padless("flowchart LR\n    A[Box] --> B@{ shape: notch-rect, label: \"Card\" } --> C[Box]").split("\n");
    expect(rows[0]).toMatch(/^▁+\s+▁+\s+▁+$/u);
    expect(rows[1]).toMatch(/^▏\s+▕\s+╱\s+▕\s+▏\s+▕$/u);
    expect(rows[2]).toMatch(/^▏  Box  ▕─+⏵▕\s+Card ▕─+⏵▏  Box  ▕$/u);
    expect(rows[3]).toMatch(/^▏\s+▕\s+▕\s+▕\s+▏\s+▕$/u);
    expect(rows[4]).toMatch(/^▔+\s+▔+\s+▔+$/u);
    const slope = rows[1].indexOf("╱");
    const wall = rows[3].indexOf("▕", 9);
    expect(slope).toBe(wall + 1);
    expect(rows[0].indexOf("▁", 9)).toBe(wall + 2);
    expect(rows[4].indexOf("▔", 9)).toBe(wall + 1);
    expect(rows.join("\n")).not.toMatch(/[┌┐└┘│├┤]/u);
  });

  it("leaves a dashed border whole, and every shape that is not a rectangle", () => {
    const drawn = padless("flowchart LR\n    A[[Sub]] --> B[Dashed] --> C{Gate} --> D[(Drum)]\n    style B stroke-dasharray:5 5");
    expect(drawn).toContain("┌");
    expect(drawn).toMatch(/┌─ ─/u);
    expect(drawn).not.toContain("◇");
    expect(drawn).toContain("(");
    expect(drawn).not.toMatch(/▁ ▁/u);
  });
});

describe("a CONTAINER takes its form from its own links, the way a box takes its", () => {
  // `tightAxes` weighs the links on a box's walls against the ones on its rules and inks the edge it is pushed out
  // on. A container was drawn on the one form whatever it held, the tally never reaching it: it is no node, and the
  // side a run meets it on is named nowhere in `edgeSides`.
  const rows = (source: string): string[] =>
    render(source, { width: 80, borders: "padless" }).split("\n");

  it("pulls the walls in and pushes the rules out where the link arrives on a RULE, down the page", () => {
    const drawn = rows("flowchart TD\n  Z[z] --> S\n  subgraph S\n    A[a]\n  end");
    expect(must(drawn.find((r) => r.includes("S")))).toMatch(/^▕.*▏$/u);
    const lid = drawn.findIndex((r) => /^▕▔+▏$/u.test(r));
    expect(lid).toBeGreaterThan(1);
    // The rule is inked on the INNER edge of its row, so a head standing there reads as a mark dropped inside the
    // frame: it stands OFF, on the row above, fed by a shaft of its own, the way it stands off a padless box.
    expect(drawn[lid - 1]).toMatch(/^\s*⏷\s*$/u);
    expect(drawn[lid - 2]).toMatch(/^\s*│\s*$/u);
    expect(drawn[drawn.length - 1]).toMatch(/^▕▁+▏$/u);
  });

  it("pushes the walls out and pulls the rules in where it arrives on a WALL, across the page", () => {
    const drawn = rows("flowchart LR\n  Z[z] --> S\n  subgraph S\n    A[a]\n  end");
    expect(must(drawn.find((r) => r.includes("S")))).toMatch(/^\s*▏.*▕$/u);
    expect(drawn.some((r) => /^\s*▁+$/u.test(r))).toBe(true);
    expect(drawn[drawn.length - 1]).toMatch(/^\s*▔+$/u);
  });

  it("gives a composite state the form its own link chooses, its floor keeping the heavy rule", () => {
    // Two of them, so the fan reaches each one from ABOVE and the rule wins the tally; a lone one is reached on its
    // wall and takes the other form, which the two cases above already pin.
    const drawn = rows(
      "stateDiagram-v2\n    [*] --> First\n    state First {\n        [*] --> second\n    }" +
        "\n    [*] --> Other\n    state Other {\n        [*] --> third\n    }"
    );
    expect(drawn.some((r) => /▕▔+▏/u.test(r))).toBe(true);
    expect(drawn.some((r) => /▕▄+▏/u.test(r))).toBe(true);
    // No head stands ON a rule of either form: a pulled-in rule would hold it inside the frame, and a pushed-out
    // one is whole by construction, the head having its own row above the lid.
    expect(drawn.join("\n")).not.toMatch(/[▁▔▄▀]⏷/u);
    expect(drawn.join("\n")).not.toContain("▀");
  });
});
