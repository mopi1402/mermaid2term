import type { XYChart } from "./model.js";
import { widestOf } from "../../text/width.js";
import { ticks } from "../@common/ticks.js";

// d3's own tick count, the one mermaid's linear axes call `ticks()` with.
export const MOST_TICKS = 10;
export const CHART_W = 50;
const BAR_WIDTH = 4;

// Where the plot and the category names are drawn: a vertical chart's column and the blank after it, a horizontal
// chart's plot width; the names cut to `label` columns.
export interface Room {
  readonly span: number;
  readonly gap: number;
  readonly label: number;
}

// A column one cell narrower at a time down to one, a single blank between two, each name cut to its column.
export function verticalRooms({ categoryWidth }: LaidOut): Room[] {
  const own = columnOf(categoryWidth);
  return Array.from({ length: own }, (_, i) => ({ span: own - i, gap: 1, label: Math.min(categoryWidth, own - i) }));
}

// The plot narrowed down to what its value labels need, then the category names cut a column at a time.
export function horizontalRooms(diagram: XYChart, laid: LaidOut): Room[] {
  const { categoryWidth } = laid;
  const floor = plotFloor(diagram, laid);
  const plots = Array.from({ length: Math.max(0, CHART_W - floor) }, (_, i) => ({ span: CHART_W - 1 - i, gap: 0, label: categoryWidth }));
  const names = Array.from({ length: Math.max(0, categoryWidth - 1) }, (_, i) => ({ span: floor, gap: 0, label: categoryWidth - 1 - i }));
  return [...plots, ...names];
}

// As mermaid's `transformDataWithoutCategory`: a band's names are the points, each plot cut to them, and the value
// scale runs over what is left from its smallest value to its largest, where no range is written.
function measured(diagram: XYChart): { low: number; high: number; span: number; points: number } | undefined {
  const banded = diagram.xCategories.length > 0;
  const points = banded ? diagram.xCategories.length : Math.max(0, ...diagram.datasets.map((ds) => ds.values.length));
  const values = diagram.datasets.flatMap((ds) => ds.values.slice(0, points));
  if (values.length === 0) return undefined;
  const [low, high] = diagram.yRange ?? [Math.min(...values), Math.max(...values)];
  // Values spread wider than a number holds have no scale to be drawn on.
  if (!Number.isFinite(high - low)) return undefined;
  return { low, high, span: high - low === 0 ? 1 : high - low, points };
}

export interface LaidOut {
  readonly low: number;
  readonly high: number;
  readonly span: number;
  readonly points: number;
  readonly categories: readonly string[];
  readonly categoryWidth: number;
  // A linear x axis's bounds, mermaid's `x-axis 10 --> 20` or, with no x axis, `1` to the longest plot.
  readonly xDomain: readonly [number, number] | undefined;
}

// A vertical chart's own column: a bar's width, wider where the names need one blank past them.
export const columnOf = (categoryWidth: number): number => Math.max(BAR_WIDTH, categoryWidth + 1);

// A horizontal plot's fewest columns: its two outer value labels and a blank beside each.
export const plotFloor = (diagram: XYChart, { low, high }: LaidOut): number =>
  2 * ((diagram.yShown.label ? widestOf(ticks(low, high, MOST_TICKS).map(String)) : 0) + 1) + 1;

export function laidOut(diagram: XYChart): LaidOut | undefined {
  const scale = measured(diagram);
  if (scale === undefined) return undefined;
  const xDomain = diagram.xCategories.length > 0 ? undefined : (diagram.xRange ?? [1, scale.points]);
  const names = xDomain === undefined ? diagram.xCategories : ticks(xDomain[0], xDomain[1], MOST_TICKS).map(String);
  const categoryWidth = diagram.xShown.label ? widestOf(names) : 0;
  return { ...scale, categories: diagram.xCategories, categoryWidth, xDomain };
}
