import { describe, it, expect } from "vitest";
import { renderThemed } from "../../src/index.js";
import { must } from "../../src/must.js";
import { gitSeat } from "../../src/paint/git.js";
import { SGR_RE } from "../support/ansi.js";

const BODY =
  ' commit id: "init" tag: "v1"\n branch develop\n commit id: "d1"\n branch feature\n commit id: "f1" type: HIGHLIGHT\n' +
  ' checkout develop\n commit id: "d2" type: REVERSE\n checkout main\n merge develop id: "m1"';

// Each escape written as `<params>`, so a row reads as the inks it lays and the glyphs they lay.
const rows = (direction: string, theme: string): string[] =>
  renderThemed(`gitGraph ${direction}:\n${BODY}`, { width: 80, background: "light" }, theme)
    .replace(SGR_RE, (_, params: string) => (params === "0" ? "" : `<${params}>`))
    .split("\n");
const rowWith = (drawn: string[], word: string): string => must(drawn.find((row) => row.includes(word)));

// mermaid's `default` on a white page: `git0` #0000EC, `git1` #DEDE00, `git2` #9DEC00, weighed to read on white.
const MAIN = "38;2;0;0;236";
const DEVELOP_LINE = "38;2;199;199;0";
const DEVELOP_BULLET = "38;2;172;172;0";
const FEATURE_LINE = "38;2;141;212;0";
const SPINE = "38;2;204;204;204";

describe("a gitGraph branch takes its mermaid seat: line, bullets and name in `git{i}`, highlight in `gitInv{i}`", () => {
  it("colours each branch apart, LR", () => {
    const drawn = rows("LR", "default");
    const main = rowWith(drawn, "main");
    expect(main).toContain("<38;2;255;255;255;48;2;0;0;236> main ");
    expect(main).toContain(`<${SPINE}>╌╌╌╌╌<${MAIN}>●─────────────────────────○<${SPINE}>╌╌╌`);
    const develop = rowWith(drawn, "develop");
    expect(develop).toContain("<38;2;0;0;0;48;2;222;222;0> develop ");
    expect(develop).toContain(`<${DEVELOP_LINE}>╰───────<${DEVELOP_BULLET}>●<${DEVELOP_LINE}>───────────<${DEVELOP_BULLET}>✖<${DEVELOP_LINE}>─────╯`);
    const feature = rowWith(drawn, "feature");
    expect(feature).toContain("<38;2;0;0;0;48;2;157;236;0> feature ");
    expect(feature).toContain(`<${FEATURE_LINE}>╰─────<38;2;49;0;147>□<${SPINE}>╌`);
  });

  it("colours each branch apart, TB", () => {
    const drawn = rows("TB", "default");
    expect(drawn[0]).toContain("<38;2;255;255;255;48;2;0;0;236> main ");
    expect(drawn[0]).toContain("<38;2;0;0;0;48;2;222;222;0> develop ");
    expect(drawn[0]).toContain("<38;2;0;0;0;48;2;157;236;0> feature ");
    expect(drawn[1]).toContain(`<${SPINE}>┊`);
    expect(rowWith(drawn, "v1")).toContain(`<${MAIN}>●<${DEVELOP_LINE}>────────────╮`);
    expect(drawn.filter((row) => row.startsWith(`        <${MAIN}>│`)).length).toBeGreaterThan(10);
    expect(drawn.some((row) => row.includes(`<${DEVELOP_BULLET}>●<${FEATURE_LINE}>────────────╮`))).toBe(true);
    expect(drawn.some((row) => row.includes(`<38;2;49;0;147>□`))).toBe(true);
    expect(drawn.some((row) => row.includes(`<${DEVELOP_BULLET}>✖`))).toBe(true);
    // A merge's second parent runs in the merged branch's ink, `drawArrow`'s `commitA.branch`.
    expect(drawn.some((row) => row.includes(`<${MAIN}>○<${DEVELOP_LINE}>────────────╯`))).toBe(true);
  });

  it("writes a tag in `tagLabelColor` framed by `tagLabelBorder` on `tagLabelBackground`, a commit label half over the page", () => {
    for (const direction of ["LR", "TB"]) {
      const tag = rowWith(rows(direction, "default"), "v1");
      expect(tag).toContain("<38;2;173;173;234;48;2;236;236;255>[<3;38;2;19;19;0;48;2;236;236;255>🏷️ v1<38;2;173;173;234;48;2;236;236;255>]");
      expect(rowWith(rows(direction, "default"), "init")).toContain("<1;38;2;0;0;33;48;2;255;255;239> init ");
    }
  });

  it("follows the redux-color sheet: the trunk in `nodeBorder`, the others on `borderColorArray` past its first seat", () => {
    for (const direction of ["LR", "TB"]) {
      const drawn = rows(direction, "redux-color");
      expect(drawn.some((row) => row.includes("<38;2;40;37;61>●"))).toBe(true);
      expect(drawn.some((row) => row.includes("<38;2;40;37;61;48;2;45;212;191> develop "))).toBe(true);
      expect(drawn.some((row) => row.includes("<38;2;45;212;191>╰") || row.includes("<38;2;45;212;191>────────────╮"))).toBe(true);
    }
    expect([gitSeat(0, 8, true), gitSeat(7, 8, true), gitSeat(8, 8, true), gitSeat(8, 8, false)]).toEqual([0, 7, 1, 0]);
  });

  it("keeps one ink for every branch on a theme of this package's own", () => {
    for (const direction of ["LR", "TB"]) {
      const drawn = rows(direction, "neon").join("\n");
      const inks = new Set([...drawn.matchAll(/<([0-9;]+)>[─│╰╯╮]/gu)].map((found) => found[1]));
      expect(inks.size).toBe(1);
    }
  });
});
