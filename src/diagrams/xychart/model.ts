type ChartType = "bar" | "line";

interface XYDataset {
  label: string;
  values: number[];
  // One per value, "" where the point carries none; mermaid writes them on a line only.
  pointLabels: string[];
  chartType: ChartType;
}

// What mermaid's `xAxis` and `yAxis` config blocks let through: `showLabel`, `showTitle`, `showTick`, `showAxisLine`.
export interface AxisShown {
  label: boolean;
  title: boolean;
  tick: boolean;
  line: boolean;
}

const ALL_SHOWN: AxisShown = { label: true, title: true, tick: true, line: true };

export interface XYChart {
  title: string;
  xLabel: string;
  yLabel: string;
  xCategories: string[];
  xRange: readonly [number, number] | undefined;
  yRange: readonly [number, number] | undefined;
  datasets: XYDataset[];
  horizontal: boolean;
  showLegend: boolean;
  showDataLabel: boolean;
  dataLabelOutside: boolean;
  showTitle: boolean;
  xShown: AxisShown;
  yShown: AxisShown;
}

export const makeXYChart = (): XYChart => ({
  title: "",
  xLabel: "",
  yLabel: "",
  xCategories: [],
  xRange: undefined,
  yRange: undefined,
  datasets: [],
  horizontal: false,
  showLegend: true,
  showDataLabel: false,
  dataLabelOutside: false,
  showTitle: true,
  xShown: ALL_SHOWN,
  yShown: ALL_SHOWN,
});

export const makeXYDataset = (values: number[], chartType: ChartType, label = "", pointLabels: string[] = []): XYDataset => ({
  label,
  values,
  pointLabels,
  chartType,
});
