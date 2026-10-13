import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { render, renderThemed } from "../../src/index.js";
import { parseMindmap } from "../../src/diagrams/mindmap/parser.js";
import { renderMindmap } from "../../src/diagrams/mindmap/render.js";
import { UNICODE } from "../../src/canvas/charsets.js";
import { EDGE } from "../../src/canvas/keys.js";
import { subtreeVertical } from "../../src/diagrams/mindmap/vertical.js";
import { makeChars } from "../../src/diagrams/mindmap/rows.js";
import { stripSgr } from "../support/ansi.js";
import { withConfig } from "../support/frontmatter.js";

const WORLD = [
  "mindmap",
  "  Monde",
  "    Europe",
  "      France",
  "      Italie",
  "      Suisse",
  "      Espagne",
  "    Asie",
  "      Japon",
  "      Chine",
  "      Vietnam",
  "    Amérique du nord",
  "      USA",
  "    Amérique du sud",
  "      Brésil",
  "      Pérou",
  "    Océanie",
  "      Australie",
  "      Nouvelle-Zélande",
  "    Afrique",
  "      Afrique du Sud",
  "      Maroc",
  "      Congo",
].join("\n");

const rows = (source: string, width: number): string[] => render(source, { width }).split("\n");

describe("a mindmap spreads its branches all round the root, in lines and rounded corners alone", () => {
  it("deals the root's branches clockwise from its right: right, below, left, above, each fan on a bar", () => {
    expect(rows(WORLD, 120)).toEqual([
      "  Australie      Nouvelle-Zélande          Afrique du Sud      Maroc      Congo",
      "      ╰────────┬─────────╯                        ╰──────────────┼──────────╯",
      "               │                                                 │",
      "            Océanie                                           Afrique",
      "               ╰────────────────────────┬────────────────────────╯",
      "                                        │",
      " Brésil ─┬──── Amérique du sud ─╮       │                       ╭─ France",
      "  Pérou ─╯                      ├──── Monde ──────── Europe ────┼─ Italie",
      "                                │       │                       ├─ Suisse",
      " USA ──────── Amérique du nord ─╯     Asie                      ╰─ Espagne",
      "                                        │",
      "                             ╭──────────┼───────────╮",
      "                           Japon      Chine      Vietnam",
    ]);
  });

  it("keeps the same deal at 76 columns, the joints and gaps a column shorter", () => {
    const wide = rows(WORLD, 120);
    const narrow = rows(WORLD, 76);
    expect(narrow).toHaveLength(wide.length);
    expect(narrow[7]).toBe("  Pérou ─╯                     ├─── Monde ────── Europe ───┼─ Italie");
    expect(Math.max(...narrow.map((row) => row.length))).toBeLessThan(Math.max(...wide.map((row) => row.length)));
  });

  it("fills the root's row first: a lone branch stays on it, on the right", () => {
    expect(rows('mindmap\n  root["Quoted [x]"]\n    a("in (parens)")\n', 80)).toEqual([" Quoted [x] ──────── in (parens)"]);
    expect(rows("mindmap\n  Root\n    A\n      A1\n    B\n", 80)).toEqual([" B ──────── Root ──────── A ──────── A1"]);
  });

  it("meets a child on its own row with the parent's arm, never a corner beside a tee", () => {
    const drawn = rows(WORLD, 120).join("\n");
    expect(drawn).toContain("Brésil ─┬──── Amérique du sud");
    expect(drawn).not.toMatch(/─[╮╭]─/u);
    expect(drawn).not.toMatch(/┬┴|┴┬/u);
  });

  it("stands a multi-row label as one rectangle, each row centred on the widest", () => {
    expect(rows("mindmap\n  Root\n    one<br>two<br/>three<br />four\n", 120)).toEqual([
      "                one",
      " Root ────────  two",
      "               three",
      "               four",
    ]);
  });

  it("inks each half of a bar for the branch it leads to, the stem for the trunk they share", () => {
    const cells = renderMindmap(parseMindmap(WORLD), UNICODE, true, 120).toStyledPairs();
    const bar = cells[4];
    const text = bar.map(([ch]) => ch).join("");
    expect(bar[text.indexOf("┬")][1]).toBe(EDGE);
    expect(bar[text.indexOf("╰")][1]).toBe("sectionfg:5");
    expect(bar[text.indexOf("╯")][1]).toBe("sectionfg:6");
  });

  it("leaves a fan's stem from its middle child's own line, however uneven the labels", () => {
    const root = parseMindmap("mindmap\n  R\n    a\n    bb\n    a long third one\n").root;
    const fan = root === undefined ? "" : subtreeVertical({ node: root, seat: undefined }, makeChars(UNICODE, true, 20), true).canvas.toString();
    expect(fan.split("\n").map((row) => row.trimEnd())).toEqual([" a    bb    a long third one", " ╰─────┼────────────╯", "       │", "       R"]);
  });

  it("keeps a blank row between the root's own branches on a spine, a branch's children tight", () => {
    expect(rows("mindmap\n  Engine\n    Parser\n    Layout\n    Routing\n    Renderer\n    Themes\n    Tests\n    Docs\n    Packaging\n", 80)).toEqual([
      "        Docs          Packaging",
      "          ╰───────┬───────╯",
      "                  │",
      "  Tests ─╮        │       ╭─ Parser",
      "         ├──── Engine ────┤",
      " Themes ─╯        │       ╰─ Layout",
      "                  │",
      "          ╭───────┴────────╮",
      "      Renderer          Routing",
    ]);
    expect(rows(WORLD, 120)[7]).toContain("Pérou ─╯");
    expect(rows(WORLD, 120)[8]).toMatch(/^ +│/u);
  });

  it("stands an even fan's stem on the line of a child a few columns off, never a tee huddled by a tee", () => {
    const drawn = render(readFileSync("fixtures/mindmap/many-children.mmd", "utf8"), { width: 120 });
    expect(drawn).toContain("╰────────────────────┴───────┬─────────┴───────────────────╯");
    expect(drawn).not.toMatch(/[┴┬]─{0,3}[┴┬]/u);
  });

  it("keeps the root's own branches side by side further apart than the children under one of them", () => {
    const top = rows(WORLD, 120)[0];
    const gap = (from: string, to: string): number => top.indexOf(to) - (top.indexOf(from) + from.length);
    expect(gap("Australie", "Nouvelle-Zélande")).toBe(6);
    expect(gap("Nouvelle-Zélande", "Afrique du Sud")).toBe(10);
  });

  it("keeps a blank row, the stem alone crossing it, between a fan's bar and the row of the root", () => {
    const drawn = rows(readFileSync("fixtures/mindmap/many-children.mmd", "utf8"), 120);
    expect(drawn).toEqual([
      " Offline sync          Public API          Reports          Localisation",
      "       ╰────────────────────┴───────┬─────────┴───────────────────╯",
      "                                    │",
      "                                    │          ╭─ Search ────┬─ Filters",
      "             Mobile app ─╮          │          │             ╰─ Saved queries",
      "                         │          │          │",
      "               Webhooks ─┼──── Release 4.0 ────┼─ Billing ──────── Invoices",
      "                         │          │          │",
      "        SAML ─┬──── SSO ─╯      Dark mode      ├─ Exports",
      "        OIDC ─╯                                │",
      "                                               ╰─ Audit log",
    ]);
  });

  const ROOT_SOURCE = "mindmap\n  Data platform\n    Ingestion\n    Storage\n";
  const groundRows = (theme: string): boolean[] => {
    const drawn = renderThemed(ROOT_SOURCE, { width: 80, background: "dark" }, theme).split("\n");
    const at = drawn.findIndex((row) => row.includes("Data platform"));
    return [drawn[at - 1] ?? "", drawn[at + 1] ?? ""].map((row) => /\u001b\[[0-9;]*48;2;[0-9;]*m {15}\u001b/u.test(row));
  };

  it.each(["default", "neon", "redux"])("raises the root on a row of its ground above its text and one below, theme %s", (theme) => {
    expect(groundRows(theme)).toEqual([true, true]);
  });

  it("keeps the ground row above the root under a title, the title's gap never eating it", () => {
    const source = "---\ntitle: Onboarding topics\n---\n" + ROOT_SOURCE;
    const drawn = renderThemed(source, { width: 80, background: "dark" }, "forest").split("\n");
    const at = drawn.findIndex((row) => row.includes("Data platform"));
    expect(/\u001b\[[0-9;]*48;2;[0-9;]*m {15}\u001b/u.test(drawn[at - 1] ?? "")).toBe(true);
    expect(drawn[at - 2]).toBe("");
  });

  it("keeps the root on one row where nothing paints its ground: no theme, or mono", () => {
    expect(rows(ROOT_SOURCE, 80)).toEqual([" Storage ──────── Data platform ──────── Ingestion"]);
    expect(groundRows("mono")).toEqual([false, false]);
    expect(renderThemed(ROOT_SOURCE, { width: 80, background: "dark" }, "mono").split("\n")).toHaveLength(1);
  });

  const TRIP = "mindmap\n  Trip plan\n    Flights\n      Outbound\n      Return\n    Hotel\n      Check-in 3 pm\n    Car hire\n      Airport pickup\n";

  it("spreads a small map round its root where no height presses, as mermaid's own drawing does", () => {
    expect(rows(TRIP, 120)).toEqual([
      "                                    Airport pickup",
      "                                           │",
      "                                       Car hire",
      "                                           │",
      " Check-in 3 pm ──────── Hotel ──────── Trip plan ──────── Flights ────┬─ Outbound",
      "                                                                      ╰─ Return",
    ]);
  });

  it("flattens it onto the root's row once the drawing runs past the height it was given", () => {
    expect(render(TRIP, { width: 120, height: 4 }).split("\n")).toEqual([
      " Airport pickup ──────── Car hire ─╮",
      "                                   ├──── Trip plan ──────── Flights ────┬─ Outbound",
      "     Check-in 3 pm ──────── Hotel ─╯                                    ╰─ Return",
    ]);
    expect(render(WORLD, { width: 120, height: 12 }).split("\n").length).toBeLessThanOrEqual(12);
  });

  it("spreads the root's branches on as many sides as fit, the raised root of a theme spreading them as the plain one does", () => {
    const source = readFileSync("fixtures/mindmap/basic.mmd", "utf8");
    const plain = (text: string): string[] => stripSgr(text).split("\n").map((row) => row.trimEnd());
    const themed = plain(renderThemed(source, { width: 80, background: "dark" }, "default"));
    expect(themed[0].trim()).toBe("Marketing     Support");
    expect(themed.find((row) => row.includes("Project"))).toContain("Development ────── Project ────── Planning");
  });

  const BASIC = readFileSync("fixtures/mindmap/basic.mmd", "utf8");
  const tidy = (config: string): string => withConfig(`${config}\n`, BASIC);

  it("deals the root's branches as mermaid's tidy tree does under `layout: tidy-tree`: even ones left, odd ones right, each side read down", () => {
    const drawn = rows(tidy("  layout: tidy-tree"), 120);
    const at = (label: string): [number, number] => {
      const row = drawn.findIndex((line) => line.includes(label));
      return [row, drawn[row].indexOf(label)];
    };
    const root = at("Project");
    expect(at("Planning")[1]).toBeLessThan(root[1]);
    expect(at("Launch")[1]).toBeLessThan(root[1]);
    expect(at("Development")[1]).toBeGreaterThan(root[1]);
    expect(at("Planning")[0]).toBeLessThan(at("Launch")[0]);
    expect(drawn.filter((line) => /[╰╭][─┬┴]*[┬┴][─┬┴]*[╯╮]/u.test(line))).toEqual([]);
  });

  it("keeps a tidy tree too wide for its budget on the root's row, one side if need be, before the indented tree", () => {
    const source = withConfig({ layout: "tidy-tree" }, readFileSync("fixtures/mindmap/checkout-migration.mmd", "utf8"));
    const drawn = rows(source, 80);
    expect(drawn.some((row) => row.startsWith(" Checkout migration ──┤"))).toBe(true);
    expect(drawn.filter((row) => /[╰╭][─┬┴]*[┬┴][─┬┴]*[╯╮]/u.test(row))).toEqual([]);
  });

  it("reads the diagram's own `config.mindmap.layout` over the global one, as mermaid 12 does", () => {
    expect(rows(tidy("  layout: elk\n  mindmap:\n    layout: tidy-tree"), 120)).toEqual(rows(tidy("  layout: tidy-tree"), 120));
    expect(rows(tidy("  layout: tidy-tree\n  mindmap:\n    layout: cose-bilkent"), 120)).toEqual(rows(BASIC, 120));
  });

  it("keeps a fan off a side where its stem would run through empty rows round a tall stack", () => {
    const drawn = rows(readFileSync("fixtures/mindmap/checkout-migration.mmd", "utf8"), 120);
    expect(drawn.find((row) => row.includes("Checkout migration"))).toContain("├─── Checkout migration ───┤");
  });
});
