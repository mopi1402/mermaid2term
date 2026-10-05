import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";
import { parseClassDiagram } from "../../src/diagrams/classdiagram/parser.js";
import { must } from "../../src/must.js";

const idsOf = (source: string): string[] => [...parseClassDiagram(source).classes.keys()];

describe("class statements mermaid reads that were dropped whole", () => {
  it("keeps a statement carrying a trailing comment, where the line went out with it", () => {
    const parsed = parseClassDiagram("classDiagram\n    A --> B %% why\n    class C %% and this\n");
    expect(parsed.relationships).toHaveLength(1);
    expect([parsed.relationships[0].source, parsed.relationships[0].target]).toEqual(["A", "B"]);
    expect(idsOf("classDiagram\n    A --> B %% why\n    class C %% and this\n")).toEqual(["A", "B", "C"]);
    expect(render("classDiagram\n    A --> B %% why\n", { width: 40 })).toContain("A");
  });

  it("leaves a `%%` inside a quoted label alone, the comment opening outside quotes only", () => {
    const cls = must(parseClassDiagram('classDiagram\n    class C["50%% off"]\n').classes.get("C"));
    expect(cls.label).toBe("50%% off");
    const note = parseClassDiagram('classDiagram\n    note "50%% off"\n').notes;
    expect(note[0].text).toBe("50%% off");
  });

  it("reads a dotted and a dashed id, which mermaid's lexer glues out of its `\\w+`, `-` and `.` tokens", () => {
    expect(idsOf("classDiagram\n    class com.acme.Duck\n")).toEqual(["com.acme.Duck"]);
    expect(idsOf("classDiagram\n    class my-dash\n")).toEqual(["my-dash"]);
    const parsed = parseClassDiagram("classDiagram\n    com.acme.Duck --> my-dash : reads\n");
    expect([parsed.relationships[0].source, parsed.relationships[0].target]).toEqual(["com.acme.Duck", "my-dash"]);
    expect(parsed.relationships[0].label).toBe("reads");
    // A dash inside an id never eats the arrow beside it, written tight or spaced.
    const tight = parseClassDiagram("classDiagram\n    my-dash-->other\n");
    expect([tight.relationships[0].source, tight.relationships[0].target]).toEqual(["my-dash", "other"]);
    expect(render("classDiagram\n    class com.acme.Duck\n", { width: 40 })).toContain("com.acme.Duck");
  });

  it("opens a body written between braces on one row, empty or carrying its members", () => {
    expect(idsOf("classDiagram\n    class A {}\n    class B { }\n")).toEqual(["A", "B"]);
    const cls = must(parseClassDiagram("classDiagram\n    class B { +x }\n").classes.get("B"));
    expect(cls.members.map((m) => m.name)).toEqual(["x"]);
    expect(cls.members[0].visibility).toBe("+");
    // mermaid's struct rule takes everything up to the brace as ONE member, spaces and all.
    const many = must(parseClassDiagram("classDiagram\n    class C { +x +y }\n").classes.get("C"));
    expect(many.members).toHaveLength(1);
    const annotated = must(parseClassDiagram("classDiagram\n    class D <<service>> { +go() }\n").classes.get("D"));
    expect(annotated.annotation).toBe("service");
    expect(annotated.members.map((m) => m.name)).toEqual(["go()"]);
  });

  it("opens a `namespace` written on one row, its class landing inside the frame", () => {
    const parsed = parseClassDiagram("classDiagram\n    namespace One { class X }\n");
    expect(parsed.namespaces).toHaveLength(1);
    expect(parsed.namespaces[0].id).toBe("One");
    expect(parsed.namespaces[0].explicit).toBe(true);
    expect(parsed.namespaces[0].classes).toEqual(["X"]);
    const drawn = render("classDiagram\n    namespace One { class X }\n", { width: 40 });
    const rows = drawn.split("\n");
    const frame = rows.findIndex((row) => row.includes("One"));
    expect(rows[frame].indexOf("One")).toBeGreaterThan(0);
    expect(rows.slice(frame).some((row) => row.includes("X"))).toBe(true);
  });

  it("reads a head written apart from its line, every head rule in mermaid's lexer opening on `\\s*`", () => {
    const parsed = parseClassDiagram("classDiagram\n    C <| -- D\n    E *-- F\n");
    expect(parsed.relationships).toHaveLength(2);
    expect(parsed.relationships[0].sourceMarker).toBe("<|");
    const spaced = parseClassDiagram("classDiagram\n    G o -- H\n");
    expect([spaced.relationships[0].source, spaced.relationships[0].target]).toEqual(["G", "H"]);
    // The tight form it has always read is untouched.
    const tight = parseClassDiagram("classDiagram\n    A<|--B\n");
    expect([tight.relationships[0].source, tight.relationships[0].target]).toEqual(["A", "B"]);
    expect(tight.relationships[0].sourceMarker).toBe("<|");
  });
});

// Each measured on mermaid 12 headless (2026-09-29).
describe("class statements mermaid 12 reads that were dropped or garbled", () => {
  const rowOf = (drawn: string, word: string): number => drawn.split("\n").findIndex((row) => row.includes(word));

  it("reads a direction wherever it stands on the line, as mermaid's `.*direction\\s+LR[^\\n]*` rule does", () => {
    for (const [written, direction] of [["LR", "LR"], ["TB", "TB"]] as const) {
      const parsed = parseClassDiagram(`classDiagram\n    xx direction ${written} and more\n    A --> B\n`);
      expect(parsed.direction).toBe(direction);
      expect(parsed.directionDeclared).toBe(true);
    }
    // The rule eats the whole line, a relation carrying the words included.
    expect(parseClassDiagram("classDiagram\n    A --> B : go direction LR\n").relationships).toHaveLength(0);
    // The class lexer is case sensitive, so a lower case pair inside a statement is the statement's text.
    expect(parseClassDiagram("classDiagram\n    A --> B : go direction lr\n").relationships).toHaveLength(1);
    // A class body is not the diagram's: the words stay a member there.
    const member = must(parseClassDiagram("classDiagram\n    class A {\n        direction LR\n    }\n").classes.get("A"));
    expect(member.members.map((m) => m.name)).toEqual(["direction LR"]);
    const across = render("classDiagram\n    xx direction LR\n    A --> B\n", { width: 80 });
    expect(rowOf(across, "A")).toBe(rowOf(across, "B"));
    const down = render("classDiagram\n    xx direction TB\n    A --> B\n", { width: 80 });
    expect(rowOf(down, "A")).toBeLessThan(rowOf(down, "B"));
  });

  it("sets an annotation written on its own line against a generic class", () => {
    const cls = must(parseClassDiagram("classDiagram\n    class Gen~T~\n    <<interface>> Gen~T~\n").classes.get("Gen"));
    expect(cls.annotation).toBe("interface");
    expect(cls.label).toBe("Gen<T>");
    for (const direction of ["TB", "LR"]) {
      const drawn = render(`classDiagram\n    direction ${direction}\n    class Gen~T~\n    <<interface>> Gen~T~\n    Gen --> B\n`, { width: 80 });
      expect(drawn).toContain("interface");
      expect(rowOf(drawn, "interface")).toBeLessThan(rowOf(drawn, "Gen<T>"));
    }
  });

  it("reads a classifier written between a method's parenthesis and its return type", () => {
    const member = must(parseClassDiagram("classDiagram\n    class A {\n        m()$ int\n        n()* bool\n    }\n").classes.get("A")).members;
    expect(member.map((m) => [m.name, m.classifier, m.returnType])).toEqual([["m()", "$", "int"], ["n()", "*", "bool"]]);
    // A blank between them makes the sign part of the return type, as mermaid's `\)([\s$*])?` reads it.
    const spaced = must(parseClassDiagram("classDiagram\n    class A {\n        m() $ int\n    }\n").classes.get("A")).members[0];
    expect([spaced.classifier, spaced.returnType]).toEqual([undefined, "$ int"]);
    for (const direction of ["TB", "LR"]) {
      const drawn = render(`classDiagram\n    direction ${direction}\n    class A {\n        m()$ int\n    }\n    A --> B\n`, { width: 80 });
      expect(drawn).toContain("m() : int");
      expect(drawn).not.toContain("$");
    }
  });

  it("frames a namespace whose name is written between backticks, dots still nesting it", () => {
    const parsed = parseClassDiagram("classDiagram\n    namespace `Tick Space` {\n        class X\n    }\n    namespace `a.b` {\n        class Y\n    }\n");
    expect(parsed.namespaces.map((ns) => ns.id)).toEqual(["Tick Space", "a"]);
    expect(parsed.namespaces[0].classes).toEqual(["X"]);
    expect(parsed.namespaces[1].children.map((ns) => [ns.id, ns.classes])).toEqual([["a.b", ["Y"]]]);
    for (const direction of ["TB", "LR"]) {
      const drawn = render(`classDiagram\n    direction ${direction}\n    namespace \`Tick Space\` {\n        class X\n        class Z\n    }\n    X --> Z\n`, { width: 80 });
      expect(drawn).toContain("Tick Space");
      expect(rowOf(drawn, "Tick Space")).toBeLessThan(rowOf(drawn, "X"));
    }
  });
});
