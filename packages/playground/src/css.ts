import type { CSSProperties } from "react";

export const cssVars = (vars: Record<`--${string}`, string>, style?: CSSProperties): CSSProperties =>
  ({ ...vars, ...style }) as CSSProperties; // boundary: React's CSSProperties knows no `--custom` property
