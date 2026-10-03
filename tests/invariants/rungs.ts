export interface Rung {
  gap: number;
  paddingX: number;
}

export const RUNGS: readonly Rung[] = [
  { gap: 5, paddingX: 4 },
  { gap: 4, paddingX: 4 },
  { gap: 3, paddingX: 4 },
  { gap: 2, paddingX: 4 },
  { gap: 1, paddingX: 4 },
  { gap: 1, paddingX: 3 },
  { gap: 1, paddingX: 2 },
  { gap: 1, paddingX: 1 },
  { gap: 1, paddingX: 0 },
];
export const PADDING_Y = 2;
export const LIGHT_RUNGS: readonly Rung[] = [
  { gap: 5, paddingX: 4 },
  { gap: 2, paddingX: 4 },
  { gap: 1, paddingX: 2 },
  { gap: 1, paddingX: 0 },
];
