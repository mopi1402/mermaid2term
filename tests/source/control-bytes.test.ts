import { describe, expect, it } from "vitest";
import { render, renderThemed } from "../../src/index.js";
import { BEL, CSI, ESC } from "../../src/paint/escapes.js";
import { stripSgr } from "../support/ansi.js";

const CLIPBOARD = `${ESC}]52;c;aGFjaw==${BEL}`;
const CLEAR = `${CSI}2J`;
const C1_CSI = "\u009b2J";
const HYPERLINK_RE = new RegExp(`${ESC}\\]8;;[^${ESC}]*${ESC}\\\\`, "gu");
const CONTROLS_RE = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/u;

const drawnBy = (direction: string, label: string): string => `---\ntitle: t${CLEAR}t\n---\ngraph ${direction}\n  A["${label}"] --> B\n  click B "https://ex.com/${CLIPBOARD}"`;

describe("a control byte in the source never reaches the terminal", () => {
  for (const direction of ["TD", "LR"]) {
    for (const label of [`x${CLIPBOARD}y${CLEAR}z`, "x&#27;[2Jy", "x#155;2Jy", `x${C1_CSI}y\rz`]) {
      it(`${direction}, ${JSON.stringify(label)}: plain`, () => {
        expect(render(drawnBy(direction, label), { width: 80 })).not.toMatch(CONTROLS_RE);
      });

      it(`${direction}, ${JSON.stringify(label)}: themed, past its own SGR and links`, () => {
        const themed = renderThemed(drawnBy(direction, label), { width: 80 }, "classic");
        expect(stripSgr(themed).replace(HYPERLINK_RE, "")).not.toMatch(CONTROLS_RE);
      });
    }
  }

  it("draws what is left of the label, the bytes alone gone", () => {
    expect(render(`graph LR\n  A["x${CLIPBOARD}y"]`, { width: 80 })).toContain("x]52;c;aGFjaw==y");
  });
});
