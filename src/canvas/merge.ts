import { armsOf } from "./alphabet.js";

export const UP = 1;
export const DOWN = 2;
export const LEFT = 4;
export const RIGHT = 8;
export const ACROSS = LEFT | RIGHT;
export const DOWNWARD = UP | DOWN;

export const SHADOW = "";

export function directionsOf(ch: string): number {
  const arms = armsOf(ch);
  if (arms === undefined) return 0;
  return (arms[0] ? LEFT : 0) | (arms[1] ? RIGHT : 0) | (arms[2] ? UP : 0) | (arms[3] ? DOWN : 0);
}
