import { describe, expect, it } from "vitest";

import { turns } from "@/throttle";

const bench = () => {
  let pending: (() => void) | undefined;
  let next = 1;
  const booked: number[] = [];
  const dropped: number[] = [];
  const fired: number[] = [];

  const gate = turns(
    () => fired.push(fired.length),
    (turn) => {
      pending = turn;
      const id = next++;
      booked.push(id);
      return id;
    },
    (id) => {
      pending = undefined;
      dropped.push(id);
    }
  );

  return {
    gate,
    booked,
    dropped,
    fired,
    isPending: () => pending !== undefined,
    tick: () => {
      const turn = pending;
      pending = undefined;
      turn?.();
    },
  };
};

describe("turns", () => {
  it("books one turn however many values arrive before it fires", () => {
    const { gate, booked } = bench();
    gate.offer();
    gate.offer();
    gate.offer();
    expect(booked).toEqual([1]);
  });

  it("books again once the turn has fired", () => {
    const { gate, booked, fired, tick } = bench();
    gate.offer();
    tick();
    gate.offer();
    expect(fired).toHaveLength(1);
    expect(booked).toEqual([1, 2]);
  });

  // StrictMode mounts twice: a `stop` that left its id standing froze the playground on its first size.
  it("books again after a stop, the turn it cancelled leaving nothing behind", () => {
    const { gate, booked, dropped, isPending } = bench();
    gate.offer();
    gate.stop();
    expect(dropped).toEqual([1]);
    gate.offer();
    expect(booked).toEqual([1, 2]);
    expect(isPending()).toBe(true);
  });

  it("cancels nothing when no turn is booked", () => {
    const { gate, dropped, tick } = bench();
    gate.offer();
    tick();
    gate.stop();
    expect(dropped).toEqual([]);
  });
});
