import { describe, it, expect } from "vitest";
import { renderThemed } from "../../src/index.js";
import { must } from "../../src/must.js";

describe("a drum's edge says what lies behind each glyph: the back rim on the page, the lid and the foot on the drum's own fill", () => {
  const IN_CLUSTER = "flowchart LR\n  subgraph S\n    D[(PostgreSQL)]\n  end";
  const ALONE = "flowchart LR\n  D[(PostgreSQL)]";
  const CLUSTER = "48;2;255;255;222";
  const FILL = "48;2;236;236;255";
  const RIM = "▁".repeat(14);

  it("lays the cluster's ground behind the back rim, the parens, the walls and the feet, inside a subgraph", () => {
    const rows = renderThemed(IN_CLUSTER, { look: "classic", background: "light" }, "default").split("\n");
    const ink = "38;2;147;112;219";
    expect(rows.find((r) => r.includes(RIM) && !r.includes("("))).toContain(`${ink};${CLUSTER}m${RIM}`);
    const lid = must(rows.find((r) => r.includes("(")));
    expect(lid).toContain(`${ink};${CLUSTER}m(`);
    expect(lid).toContain(`${ink};${CLUSTER}m)`);
    expect(rows.find((r) => r.includes("PostgreSQL"))).toContain(`${ink};${CLUSTER}m⎜`);
    const foot = must(rows.find((r) => r.includes("⎝")));
    expect(foot).toContain(`${ink};${CLUSTER}m⎝`);
    expect(foot).toContain(`${ink};${CLUSTER}m⎠`);
  });

  it("lays the drum's own fill behind the lid's line and the foot's line, in a cluster or alone", () => {
    for (const source of [IN_CLUSTER, ALONE]) {
      const rows = renderThemed(source, { look: "classic", background: "light" }, "default").split("\n");
      expect(rows.find((r) => r.includes("("))).toContain(`38;2;147;112;219;${FILL}m${RIM}`);
      expect(rows.find((r) => r.includes("⎝"))).toContain(`38;2;147;112;219;${FILL}m${RIM}`);
    }
  });

  it("leaves the back rim, the parens and the feet bare where the drum stands on the page alone", () => {
    const rows = renderThemed(ALONE, { look: "classic", background: "light" }, "default").split("\n");
    expect(rows[0]).not.toContain("48;2;");
    expect(rows[1]).toMatch(/^\u001b\[38;2;147;112;219m\(\u001b\[0m/u);
    expect(rows[rows.length - 1]).toMatch(/^\u001b\[38;2;147;112;219m⎝\u001b\[0m/u);
  });
});

describe("a queue (`h-cyl`) filled from its left arc to its right cap, the seam and its sliver on the barrel's own fill", () => {
  const FILL = "48;2;255;244;221";
  const STROKE = "38;2;238;221;187";

  it("lays the fill behind the rims, the seam arc, the tie, the undertie and the sliver's blanks, and leaves both ends bare", () => {
    const rows = renderThemed("flowchart LR\n  Q@{shape: h-cyl, label: Queue}", { look: "classic", background: "light" }, "base").split("\n");
    expect(rows.find((r) => r.includes("⁀"))).toContain(`${STROKE}m⎛\u001b[0m\u001b[${STROKE};${FILL}m▔▔▔▔▔▔▔▔▔⎛⁀\u001b[0m\u001b[${STROKE}m⎞`);
    expect(rows.find((r) => r.includes("‿"))).toContain(`${STROKE};${FILL}m▁▁▁▁▁▁▁▁▁⎝‿\u001b[0m\u001b[${STROKE}m⎠`);
    const wall = must(rows.find((r) => r.includes("Queue")));
    expect(wall).toContain(`${STROKE};${FILL}m⎜ \u001b[0m\u001b[${STROKE}m⎟`);
    expect(wall).toMatch(new RegExp(`^\u001b\\[${STROKE}m⎜\u001b\\[0m\u001b\\[${FILL}m`, "u"));
  });
});

describe("the flats, the open rows and the divider of a shape have its fill behind them", () => {
  const FILL = "48;2;255;244;221";
  const STROKE = "38;2;238;221;187";
  const drawn = (source: string): string[] => renderThemed(source, { look: "classic", background: "light" }, "base").split("\n");

  it("lays the fill behind a sheared shape's `▔` and `▁`, its slopes standing bare", () => {
    for (const shape of ["[/Para/]", "[\\Alt\\]", "[/Trap\\]", "[\\TrapAlt/]"]) {
      const rows = drawn(`flowchart LR\n  A${shape}`);
      expect(rows.find((r) => r.includes("▔"))).toMatch(new RegExp(`${STROKE}m[╱╲]\u001b\\[0m\u001b\\[${STROKE};${FILL}m▔+\u001b\\[0m\u001b\\[${STROKE}m[╱╲]`, "u"));
      expect(rows.find((r) => r.includes("▁"))).toContain(`${STROKE};${FILL}m▁`);
    }
  });

  it("lays NO fill under a comment or braces, the label in the plain ink, the brace alone in the stroke", () => {
    const comment = drawn("flowchart LR\n  C@{shape: comment, label: Comment}").join("\n");
    expect(comment).not.toContain(FILL);
    expect(comment).toContain(`${STROKE}m⎧`);
    expect(comment).toMatch(/\u001b\[1;38;2;51;51;51mComment\u001b\[0m/u);
    const braces = drawn("flowchart LR\n  B@{shape: braces, label: Braces}").join("\n");
    expect(braces).not.toContain(FILL);
    expect(braces).toContain(`${STROKE}m⎭`);
  });

  it("lays the fill behind a divided rectangle's rule, its tees standing bare with the frame", () => {
    const rows = drawn("flowchart LR\n  D@{shape: div-rect, label: Divided}");
    expect(rows.find((r) => r.includes("├"))).toContain(`${STROKE}m├\u001b[0m\u001b[${STROKE};${FILL}m─`);
  });

  it("lays the fill behind a subroutine's inner bars and a lined rectangle's, the frame's wall standing bare", () => {
    const sub = must(drawn("flowchart LR\n  S[[Subroutine]]").find((r) => r.includes("Subroutine")));
    expect(sub).toContain(`${STROKE}m│\u001b[0m\u001b[${STROKE};${FILL}m│`);
    expect(sub).toContain(`${STROKE};${FILL}m│\u001b[0m\u001b[${STROKE}m│`);
    const lined = must(drawn("flowchart LR\n  L@{shape: lin-rect, label: Lined}").find((r) => r.includes("Lined")));
    expect(lined).toContain(`${STROKE}m│\u001b[0m\u001b[${STROKE};${FILL}m│`);
    expect(lined).not.toContain(`${STROKE};${FILL}m│\u001b[0m\u001b[${STROKE}m│`);
  });

  it("leaves a hexagon's flats bare at every height, each on a row of its own with the outside behind it", () => {
    for (const paddingY of [0, 2]) {
      const rows = renderThemed("flowchart LR\n  H{{Hexagon}}", { look: "classic", background: "light", paddingY }, "base").split("\n");
      expect(rows[0]).toContain(`${STROKE}m\u2581`);
      expect(rows[0]).not.toContain(`${FILL}m\u2581`);
      expect(must(rows.at(-1))).toContain(`${STROKE}m\u2594`);
      expect(must(rows.at(-1))).not.toContain(`${FILL}m\u2594`);
    }
  });

  it("keeps the fill behind the bars under `borderless`, where the wall beside them is the slab's edge", () => {
    const rows = renderThemed("flowchart LR\n  S[[Subroutine]]", { look: "classic", background: "light", borders: "borderless" }, "base").split("\n");
    const row = must(rows.find((r) => r.includes("Subroutine")));
    expect(row).toContain(`${STROKE};${FILL}m│`);
    expect(row).not.toMatch(new RegExp(`${STROKE}m│`, "u"));
  });
});
