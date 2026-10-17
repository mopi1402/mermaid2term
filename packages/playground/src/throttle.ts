import { useEffect, useRef, useState } from "react";

export interface Turns {
  readonly offer: () => void;
  readonly stop: () => void;
}

// One turn booked at a time; `stop` clears the id, or a stale one would block every later booking.
export const turns = (
  fire: () => void,
  book: (turn: () => void) => number = requestAnimationFrame,
  drop: (booked: number) => void = cancelAnimationFrame
): Turns => {
  let booked: number | undefined;

  return {
    offer: () => {
      if (booked !== undefined) return;
      booked = book(() => {
        booked = undefined;
        fire();
      });
    },
    stop: () => {
      if (booked === undefined) return;
      drop(booked);
      booked = undefined;
    },
  };
};

export function useThrottled<T>(value: T): T {
  const [shown, setShown] = useState(value);
  const latest = useRef(value);
  const held = useRef<Turns | undefined>(undefined);
  held.current ??= turns(() => setShown((current) => (Object.is(latest.current, current) ? current : latest.current)));
  const pace = held.current;

  useEffect(() => {
    latest.current = value;
    pace.offer();
  });

  useEffect(() => () => pace.stop(), [pace]);

  return shown;
}
