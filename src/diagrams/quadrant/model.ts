interface QuadrantPoint {
  label: string;
  x: number;
  y: number;
  // The marker's own fill, `#RRGGBB`, off the point's `color` or its class's; the theme's otherwise.
  color: string | undefined;
}

export interface QuadrantChart {
  title: string;
  xLabel: string;
  yLabel: string;
  quadrant1: string;
  quadrant2: string;
  quadrant3: string;
  quadrant4: string;
  points: QuadrantPoint[];
  // mermaid's `xAxisPosition`, `top` unless told `bottom`; a chart with points has its x axis at the bottom anyway.
  xAxisTop: boolean;
  // mermaid's `yAxisPosition`, `left` unless told `right`.
  yAxisRight: boolean;
}

export const makeQuadrantChart = (): QuadrantChart => ({
  title: "",
  xLabel: "",
  yLabel: "",
  // mermaid's `quadrant1Text` and the three others default to nothing: an unnamed quadrant shows its fill alone.
  quadrant1: "",
  quadrant2: "",
  quadrant3: "",
  quadrant4: "",
  points: [],
  xAxisTop: true,
  yAxisRight: false,
});
