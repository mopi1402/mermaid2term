import { COMPOSITE, INK_MARK, gradientOff } from "../canvas/keys.js";
import { themeRgb } from "../colour/colours.js";
import { formatHex, type RGB } from "../colour/rgb.js";
import { NEO_LOOK } from "../source/source.js";
import { mixRGB } from "../colour/palette.js";
import { type Theme } from "./theme-model.js";
import { DEFAULT_THEME } from "./catalogue.js";
import { inked } from "./style.js";

export interface Gradient {
  readonly start: RGB;
  readonly stop: RGB;
}

const wearsNeo = (look: string | undefined): boolean => look === NEO_LOOK;

// mermaid's `neo` look strokes a node and a cluster with `nodeBorder` (`[data-look="neo"].node rect`, a state's
// `stateBorder` outranked), the gradient over it where the theme turns one on, and
// fills a composite state's name band `mainBkg` (`[data-look="neo"].statediagram-cluster rect`) where the theme or
// the source names a `compositeTitleBackground` of its own.
// One framed theme per theme, so what is worked out once per theme is not worked out again on each try of the fit.
const FRAMED = new WeakMap<Theme, Theme>();
export function neoFramed(th: Theme, look: string | undefined): Theme {
  if (!wearsNeo(look)) return th;
  const known = FRAMED.get(th);
  if (known !== undefined) return known;
  const own = th.stated.compositeTitleBackground;
  const banded = own === undefined || own === th.stated.mainBkg ? th : { ...th, variables: { ...th.variables, compositeTitleBackground: th.variables.mainBkg } };
  const border = th.variables.nodeBorder;
  const framed =
    border === undefined ? banded : { ...banded, node: inked(th.weights.node, border), subgraph: inked(th.weights.subgraph, border) };
  FRAMED.set(th, framed);
  return framed;
}

// mermaid's `insertLookDefs`: under `neo`, a theme with `useGradient` strokes every box from `gradientStart` on its
// left edge to `gradientStop` on its right (`gradientUnits: objectBoundingBox`, `x1` 0% to `x2` 100%).
// `mono` keeps the terminal's inks under the look it merely defaults to, and wears its grey pair only when asked.
export function gradientOf(th: Theme, look: string | undefined, asked = false): Gradient | undefined {
  if (!wearsNeo(look) || !(th.variables.useGradient || (asked && th.name === DEFAULT_THEME))) return undefined;
  const start = themeRgb(th.variables.gradientStart);
  const stop = themeRgb(th.variables.gradientStop);
  return start === undefined || stop === undefined ? undefined : { start, stop };
}

type Cells = Array<Array<readonly [string, string]>>;

// Each marked cell takes the step of its column across its own box, measured on the finished drawing so a folded
// column or a flipped graph is measured as drawn. A box whose owner states its own stroke keeps it, as an inline
// `stroke` wins over mermaid's stylesheet; its mark is simply taken out.
export function inkGradients(rows: Cells, gradient: Gradient, stroked: ReadonlySet<string>): void {
  const spans = new Map<number, { min: number; max: number }>();
  for (const row of rows) {
    row.forEach(([, key], c) => {
      const marked = gradientOff(key);
      if (marked === undefined) return;
      const span = spans.get(marked.box);
      if (span === undefined) spans.set(marked.box, { min: c, max: c });
      else spans.set(marked.box, { min: Math.min(span.min, c), max: Math.max(span.max, c) });
    });
  }
  for (const row of rows) {
    row.forEach(([ch, key], c) => {
      const marked = gradientOff(key);
      if (marked === undefined) return;
      const span = spans.get(marked.box);
      const owner = marked.before.split(COMPOSITE)[0];
      if (span === undefined || stroked.has(owner)) {
        row[c] = [ch, marked.before + marked.after];
        return;
      }
      const t = span.max === span.min ? 0 : (c - span.min) / (span.max - span.min);
      row[c] = [ch, `${marked.before}${INK_MARK}${formatHex(mixRGB(gradient.start, gradient.stop, t))}${marked.after}`];
    });
  }
}
