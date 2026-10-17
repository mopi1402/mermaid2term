import {
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import type { LayoutChangedMeta, PanelImperativeHandle } from "react-resizable-panels";

import {
  BASE_SIZE,
  MIN_HEIGHT,
  MIN_WIDTH,
  PINCH_SENSITIVITY,
  PROBE,
  WIDTH_BEFORE_MEASURE,
  ZOOM_BASE,
  clampZoom,
} from "@/settings";
import { cssVars } from "@/css";

type Ref<T> = RefObject<T | null>; // boundary: React's own ref shape

// The mono's advance and natural line, per px of font size, read once from the probe.
interface Ratios {
  readonly advance: number;
  readonly line: number;
}

export interface Sizing {
  readonly fontSize: number;
  readonly column: number;
  readonly line: number;
}

// Chrome floors every box to this quantum while text keeps its exact advance, so a column is a multiple of it.
const LAYOUT_QUANTUM = 1 / 64;
export const columnQuantum = (dpr: number): number => (Number.isInteger(1 / LAYOUT_QUANTUM / dpr) ? 1 / dpr : 1);

export const sized = (nominal: number, ratios: Ratios | undefined, dpr: number): Sizing | undefined => {
  if (ratios === undefined || ratios.advance <= 0 || ratios.line <= 0) return undefined;
  const quantum = columnQuantum(dpr);
  const column = Math.max(quantum, Math.round((nominal * ratios.advance) / quantum) * quantum);
  const fontSize = column / ratios.advance;
  const line = Math.max(1, Math.round(fontSize * ratios.line * dpr)) / dpr;
  return { fontSize, column, line };
};

// The probe's advance is rounded to the layout quantum, so every box of the drawing holds it exactly.
export const layoutExact = (advance: number): number => Math.round(advance / LAYOUT_QUANTUM) * LAYOUT_QUANTUM;

export interface Viewport {
  readonly width: number;
  readonly height: number | undefined;
  readonly typed: string;
  readonly zoom: number;
  readonly font: CSSProperties;
  readonly area: Ref<HTMLDivElement>;
  readonly display: Ref<HTMLPreElement>;
  readonly probe: Ref<HTMLSpanElement>;
  readonly outputPanel: Ref<PanelImperativeHandle>;
  readonly container: Ref<HTMLDivElement>;
  readonly onPanelResize: () => void;
  readonly onHandleDrag: (unused: unknown, meta: LayoutChangedMeta) => void;
  readonly onWidthTyped: (value: string) => void;
  readonly changeZoom: (target: number) => void;
}

export function useViewport(): Viewport {
  const [width, setWidth] = useState(WIDTH_BEFORE_MEASURE);
  const [typed, setTyped] = useState(String(WIDTH_BEFORE_MEASURE));
  const [height, setHeight] = useState<number | undefined>(undefined);
  const [zoom, setZoom] = useState(ZOOM_BASE);
  const [ratios, setRatios] = useState<Ratios | undefined>(undefined);
  const [advance, setAdvance] = useState<number | undefined>(undefined);

  const area = useRef<HTMLDivElement | null>(null); // boundary: what React's `ref` takes
  const display = useRef<HTMLPreElement | null>(null); // boundary: what React's `ref` takes
  const probe = useRef<HTMLSpanElement | null>(null); // boundary: what React's `ref` takes
  const outputPanel = useRef<PanelImperativeHandle | null>(null); // boundary: what React's `ref` takes
  const container = useRef<HTMLDivElement | null>(null); // boundary: what React's `ref` takes
  const wanted = useRef(WIDTH_BEFORE_MEASURE);
  const lastContainerWidth = useRef<number | undefined>(undefined);

  const cell = (): number => {
    const rect = probe.current?.getBoundingClientRect();
    return rect === undefined ? 0 : rect.width / PROBE.length;
  };

  const horizontalPadding = (): number => {
    const style = display.current ? getComputedStyle(display.current) : undefined;
    return style === undefined ? 0 : parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  };

  const lineHeight = (): number => {
    const rect = probe.current?.getBoundingClientRect();
    return rect === undefined ? 0 : rect.height;
  };

  const verticalPadding = (): number => {
    const style = display.current ? getComputedStyle(display.current) : undefined;
    if (style === undefined) return 0;
    return parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + parseFloat(style.borderTopWidth);
  };

  const linesHeld = useCallback((): number | undefined => {
    const tall = display.current?.offsetHeight;
    const unit = lineHeight();
    if (tall === undefined || unit <= 0) return undefined;
    return Math.max(MIN_HEIGHT, Math.floor((tall - verticalPadding()) / unit));
  }, []);

  const columnsHeld = useCallback((): number | undefined => {
    const wide = area.current?.clientWidth;
    const unit = cell();
    if (wide === undefined || unit <= 0) return undefined;
    return Math.max(MIN_WIDTH, Math.floor((wide - horizontalPadding()) / unit));
  }, []);

  const reread = useCallback(() => {
    requestAnimationFrame(() => {
      const columns = columnsHeld();
      if (columns !== undefined) setWidth(columns);
      const lines = linesHeld();
      if (lines !== undefined) setHeight(lines);
    });
  }, [columnsHeld, linesHeld]);

  const moveHandle = useCallback(
    (columns: number) => {
      const unit = cell();
      if (unit <= 0) return;
      outputPanel.current?.resize(Math.ceil(columns * unit) + horizontalPadding() + 1);
      reread();
    },
    [reread]
  );

  useLayoutEffect(() => {
    const span = probe.current ?? undefined; // boundary: a DOM ref is null before the node mounts
    if (span !== undefined) {
      const rect = span.getBoundingClientRect();
      const size = parseFloat(getComputedStyle(span).fontSize);
      if (size > 0) setRatios({ advance: rect.width / PROBE.length / size, line: rect.height / size });
    }
    const lines = linesHeld();
    if (lines !== undefined) setHeight(lines);
    const columns = columnsHeld();
    if (columns === undefined) return;
    wanted.current = columns;
    setWidth(columns);
  }, [columnsHeld, linesHeld]);

  useEffect(() => {
    const frame = area.current ?? undefined; // boundary: a DOM ref is null before the node mounts
    if (frame === undefined) return;
    const observer = new ResizeObserver(() => {
      const lines = linesHeld();
      if (lines !== undefined) setHeight(lines);
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, [linesHeld]);

  const nominal = (BASE_SIZE * zoom) / ZOOM_BASE;
  const sizing = sized(nominal, ratios, window.devicePixelRatio || 1);

  // The probe wears the size the drawing wears, so its advance is the one the cells are cut to.
  useLayoutEffect(() => {
    const measured = cell();
    if (measured > 0) setAdvance((current) => (current === measured ? current : measured));
  }, [sizing?.fontSize]);

  const settledZoom = useDeferredValue(zoom);
  useEffect(reread, [settledZoom, reread]);

  useEffect(() => {
    const target = area.current ?? undefined; // boundary: a DOM ref is null before the node mounts
    if (target === undefined) return;

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      setZoom((current) => clampZoom(current * Math.exp(-event.deltaY * PINCH_SENSITIVITY)));
    };

    target.addEventListener("wheel", onWheel, { passive: false });
    return () => target.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => setTyped(String(width)), [width]);

  const onPanelResize = () => {
    const wide = container.current?.clientWidth;
    const windowMoved = wide !== undefined && lastContainerWidth.current !== undefined && wide !== lastContainerWidth.current;
    lastContainerWidth.current = wide;

    if (windowMoved) moveHandle(wanted.current);
    else reread();
  };

  const onHandleDrag = (_: unknown, meta: LayoutChangedMeta) => {
    if (!meta.isUserInteraction) return;
    const columns = columnsHeld();
    if (columns !== undefined) wanted.current = columns;
  };

  const onWidthTyped = (value: string) => {
    setTyped(value);
    const asked = Number(value);
    if (!Number.isFinite(asked) || Math.floor(asked) < MIN_WIDTH) return;
    const columns = Math.floor(asked);
    wanted.current = columns;
    moveHandle(columns);
  };

  return {
    width,
    height,
    typed,
    zoom,
    font:
      sizing === undefined || advance === undefined
        ? { fontSize: `${nominal}px` }
        : cssVars({ "--cell": `${layoutExact(advance)}px` }, { fontSize: `${sizing.fontSize}px`, lineHeight: `${sizing.line}px` }),
    area,
    display,
    probe,
    outputPanel,
    container,
    onPanelResize,
    onHandleDrag,
    onWidthTyped,
    changeZoom: (target: number) => setZoom(clampZoom(target)),
  };
}
