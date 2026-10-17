import { describe, expect, it } from "vitest";

import { columnQuantum, layoutExact, sized } from "@/viewport";

const MENLO = { advance: 0.6021, line: 1.1667 };
const LAYOUT_QUANTUM = 1 / 64;
const whole = (value: number, unit: number): boolean => Math.abs(value / unit - Math.round(value / unit)) < 1e-9;

describe("the size the drawing is set in", () => {
  it("is nominal until the probe has been read", () => {
    expect(sized(12, undefined, 2)).toBeUndefined();
  });

  it("cuts a column that layout keeps exactly and that is whole device pixels where both can hold", () => {
    for (const dpr of [1, 2, 3, 4]) {
      for (const nominal of [6, 9.6, 12, 13.2, 24, 48]) {
        const sizing = sized(nominal, MENLO, dpr);
        expect(sizing).toBeDefined();
        if (sizing === undefined) return;
        expect(whole(sizing.column, LAYOUT_QUANTUM)).toBe(true);
        expect(whole(sizing.column, columnQuantum(dpr))).toBe(true);
        expect(whole(sizing.line * dpr, 1)).toBe(true);
        expect(sizing.fontSize * MENLO.advance).toBeCloseTo(sizing.column, 9);
      }
    }
  });

  it("takes the device pixel as quantum where it is a multiple of the layout's, a whole pixel otherwise", () => {
    expect(columnQuantum(1)).toBe(1);
    expect(columnQuantum(2)).toBe(0.5);
    expect(columnQuantum(4)).toBe(0.25);
    expect(columnQuantum(3)).toBe(1);
    expect(columnQuantum(1.5)).toBe(1);
  });

  it("moves the size by less than one column of advance", () => {
    const sizing = sized(12, MENLO, 2);
    expect(sizing).toBeDefined();
    if (sizing === undefined) return;
    expect(Math.abs(sizing.fontSize - 12) * MENLO.advance).toBeLessThan(columnQuantum(2));
  });

  it("cuts the cells to the measured advance rounded to the layout quantum", () => {
    expect(layoutExact(6.99890625)).toBe(7);
    expect(layoutExact(7.7201)).toBe(7.71875);
    expect(whole(layoutExact(9.13), LAYOUT_QUANTUM)).toBe(true);
  });
});
