export interface NodePlacement {
  nodeId: string;
  grid: GridCoord;
  drawX: number;
  drawY: number;
  drawWidth: number;
  drawHeight: number;
  bar: boolean;
  own: boolean;
  overhangs: boolean;
  mark: boolean;
}

export interface DrumSeat {
  rim: DrumRim;
  anchor: DrumAnchor;
  lines: number;
}
export enum TightAxis {
  HORIZONTAL = "horizontal",
  VERTICAL = "vertical",
}

export interface GridCoord {
  col: number;
  row: number;
}

export enum DrumRim {
  ABOVE = "above",
  BELOW = "below",
}
export enum DrumAnchor {
  TOP = "top",
  BOTTOM = "bottom",
  STRETCH = "stretch",
  SPAN = "span",
}
