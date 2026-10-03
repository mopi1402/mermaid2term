import { Direction } from "./graph/model.js";
import { DEFAULT_RENDER, type RenderOptions } from "./options.js";
import { firstFitting, widestLine } from "./text/width.js";
import { NEWLINE } from "./text/chars.js";

const COMPACT_STEPS: ReadonlyArray<{
  gap?: number;
  paddingX?: number;
  wrapLabels?: boolean;
  airyLabels?: boolean;
  snugFrames?: boolean;
}> = [
  { snugFrames: true },
  { snugFrames: true, airyLabels: false },
  { snugFrames: true, gap: 3, airyLabels: false },
  { snugFrames: true, gap: 2, airyLabels: false },
  { snugFrames: true, gap: 1, airyLabels: false },
  { snugFrames: true, gap: 1, paddingX: 3, airyLabels: false },
  { snugFrames: true, gap: 1, paddingX: 2, airyLabels: false },
  { snugFrames: true, gap: 1, paddingX: 1, airyLabels: false },
  { snugFrames: true, gap: 1, paddingX: 0, airyLabels: false },
  { snugFrames: true, gap: 1, paddingX: 0, wrapLabels: true, airyLabels: false },
];

const COMPACT_ROWS: ReadonlyArray<number> = [0];

const BREATH_GAP = DEFAULT_RENDER.gap + 1;

// The caller's gap and the source's own spacings, each moved alike: the fit tightens or airs them together.
const gapsOf = (options: Partial<RenderOptions>): number[] =>
  [options.gap ?? DEFAULT_RENDER.gap, options.nodeGap, options.rankGap].filter((cells) => cells !== undefined);
const regapped = (options: Partial<RenderOptions>, move: (cells: number) => number): Partial<RenderOptions> => ({
  gap: move(options.gap ?? DEFAULT_RENDER.gap),
  ...(options.nodeGap === undefined ? {} : { nodeGap: move(options.nodeGap) }),
  ...(options.rankGap === undefined ? {} : { rankGap: move(options.rankGap) }),
});

// How a drawing meets a width: the engine's airs its gaps where the width allows and tightens them on the ladder
// where it does not, a kind's own only tightens them ("spaces": gaps and paddings alone, never folded nor wrapped),
// and one that fits itself is left to its own budget.
export type Fit = "breathes" | "tightens" | "spaces" | "itself";

const rowsOf = (drawn: string): number => drawn.split(NEWLINE).length;

export function oriented<T>(
  produce: (options: Partial<RenderOptions>, direction: Direction | undefined) => T,
  plainOf: (result: T) => string,
  options: Partial<RenderOptions>,
  width: number | undefined,
  height: number | undefined,
  fit: Fit,
  start: Direction | undefined,
  turns: boolean
): T {
  const across = fitted((o) => produce(o, start), plainOf, options, width, height, fit);
  if (!turns || width === undefined) return across;

  const down = fitted((o) => produce(o, Direction.TB), plainOf, options, width, height, fit);
  const wideAcross = widestLine(plainOf(across));
  const wideDown = widestLine(plainOf(down));

  if (wideAcross <= width && wideDown <= width) {
    return rowsOf(plainOf(down)) < rowsOf(plainOf(across)) ? down : across;
  }
  if (wideAcross <= width) return across;
  if (wideDown <= width) return down;
  return wideDown < wideAcross ? down : across;
}

function fitted<T>(
  produce: (options: Partial<RenderOptions>) => T,
  plainOf: (result: T) => string,
  options: Partial<RenderOptions>,
  width: number | undefined,
  height: number | undefined,
  fit: Fit
): T {
  let settled = options;
  let result = produce(settled);
  if (width !== undefined && fit !== "itself") {
    const gaps = gapsOf(options);
    const gap = Math.max(...gaps);
    const widest = widestLine(plainOf(result));
    if (widest <= width) {
      if (fit === "breathes" && widest < width && gaps.every((cells) => cells === DEFAULT_RENDER.gap)) {
        const airier = { ...options, ...regapped(options, () => BREATH_GAP) };
        const aired = produce(airier);
        if (widestLine(plainOf(aired)) <= width) {
          settled = airier;
          result = aired;
        }
      }
    } else {
      const paddingX = options.paddingX ?? DEFAULT_RENDER.paddingX;
      const wraps = fit !== "spaces" && (options.autoWrap ?? DEFAULT_RENDER.autoWrap);
      const airy = options.airyLabels ?? DEFAULT_RENDER.airyLabels;
      const snug = options.snugFrames ?? DEFAULT_RENDER.snugFrames;
      const rungs: Array<{ settled: Partial<RenderOptions>; folds: boolean }> = [];
      for (const step of COMPACT_STEPS) {
        const stepGap = step.gap ?? gap;
        const stepPaddingX = step.paddingX ?? paddingX;
        const stepWrap = step.wrapLabels === true && wraps;
        const stepAiry = step.airyLabels ?? airy;
        const stepSnug = step.snugFrames ?? snug;
        if (step.wrapLabels === true && !wraps) continue;
        if (stepGap >= gap && stepPaddingX >= paddingX && !stepWrap && stepAiry === airy && stepSnug === snug) continue;
        rungs.push({
          settled: {
            ...options,
            ...regapped(options, (cells) => Math.min(stepGap, cells)),
            paddingX: stepPaddingX,
            wrapLabels: stepWrap,
            airyLabels: stepAiry,
            snugFrames: stepSnug,
          },
          folds: stepWrap,
        });
      }
      let last = -1;
      // Every rung is at least as tight as the one above it in every lever, so a budget the tightest cannot meet is
      // one none of them can. Asked first, it settles the whole ladder in one drawing instead of ten.
      for (let at = 0; at < rungs.length; at++) if (!rungs[at].folds) last = at;
      const known = last > 0 ? produce(rungs[last].settled) : undefined;
      const skips = known !== undefined && widestLine(plainOf(known)) > width;
      const tries = rungs.map((_, at) => at).filter((at) => !skips || at >= last);
      const drawnAt = (at: number): { settled: Partial<RenderOptions>; result: T } => ({
        settled: rungs[at].settled,
        result: at === last && known !== undefined ? known : produce(rungs[at].settled),
      });
      const fitting = firstFitting(tries, drawnAt, (tried) => widestLine(plainOf(tried.result)), width);
      if (fitting !== undefined) {
        settled = fitting.settled;
        result = fitting.result;
      }
      const tight = widestLine(plainOf(result));
      if (tight > width && fit !== "spaces") {
        const airy = banded(produce, plainOf, options, width, widest);
        const squeezed = airy !== undefined && airy.wide <= width ? undefined : banded(produce, plainOf, settled, width, tight);
        const folded = [airy, squeezed]
          .filter((fold): fold is Folded<T> => fold !== undefined)
          .sort((a, b) => a.wide - b.wide)[0];
        if (folded !== undefined && folded.wide < tight) {
          settled = folded.settled;
          result = folded.result;
        }
      }
    }
  }
  return shortened(produce, plainOf, settled, result, height);
}

const MAX_BANDS = 12;

interface Folded<T> {
  settled: Partial<RenderOptions>;
  result: T;
  wide: number;
}

function banded<T>(
  produce: (options: Partial<RenderOptions>) => T,
  plainOf: (result: T) => string,
  options: Partial<RenderOptions>,
  width: number,
  unfolded: number
): Folded<T> | undefined {
  const folded = (bands: number): Folded<T> | undefined => {
    const settled = { ...options, bands };
    const result = produce(settled);
    const wide = widestLine(plainOf(result));
    return wide >= unfolded ? undefined : { settled, result, wide };
  };

  const gentlest = folded(2);
  if (gentlest === undefined || gentlest.wide <= width) return gentlest;

  let best = gentlest;
  let fits: Folded<T> | undefined;
  let low = 3;
  let high = MAX_BANDS;
  while (low <= high) {
    const bands = (low + high) >> 1;
    const tried = folded(bands);
    if (tried === undefined) high = bands - 1;
    else if (tried.wide <= width) {
      fits = tried;
      high = bands - 1;
    } else {
      best = tried;
      low = bands + 1;
    }
  }
  return fits ?? best;
}

function shortened<T>(
  produce: (options: Partial<RenderOptions>) => T,
  plainOf: (result: T) => string,
  settled: Partial<RenderOptions>,
  result: T,
  height: number | undefined
): T {
  if (height === undefined || rowsOf(plainOf(result)) <= height) return result;
  const paddingY = settled.paddingY ?? DEFAULT_RENDER.paddingY;
  let shorter = result;
  let tightened = settled;
  for (const step of COMPACT_ROWS) {
    if (step >= paddingY) continue;
    tightened = { ...settled, paddingY: step };
    shorter = produce(tightened);
    if (rowsOf(plainOf(shorter)) <= height) break;
  }
  if (rowsOf(plainOf(shorter)) > height && settled.mirrorActors === undefined) {
    return produce({ ...tightened, mirrorActors: true });
  }
  return shorter;
}
