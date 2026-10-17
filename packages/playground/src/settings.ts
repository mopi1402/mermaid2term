export const ADDRESS_DELAY = 500;

export const DRAWER = 256;
export const DRAWER_MIN = 160;
export const DRAWER_MAX = 600;

export const REPOSITORY = "https://github.com/mopi1402/mermaid2term";

export const THEME = "default";

export const WIDTH_BEFORE_MEASURE = 80;
export const MIN_WIDTH = 10;
export const MIN_HEIGHT = 6;

export const SOURCE_SHARE = "33.333%";
export const OUTPUT_SHARE = "66.667%";
export const FLOOR = "15%";
export const TEXT_SHARE = "45%";
export const DIAGRAM_SHARE = "55%";

export const NO_LIGATURES = { fontVariantLigatures: "none" } as const;

export const LINE_HEIGHT = { lineHeight: "normal" } as const;
export const DRAWING = { ...NO_LIGATURES, ...LINE_HEIGHT, unicodeBidi: "bidi-override" } as const;

export const ZOOM_MIN = 25;
export const ZOOM_MAX = 400;
export const ZOOM_BASE = 100;
export const ZOOM_STEP = 10;
export const BASE_SIZE = 12;

export const OUTPUT_FLOOR = 200;

export const clampZoom = (target: number): number => Math.min(Math.max(Math.round(target), ZOOM_MIN), ZOOM_MAX);

export const PINCH_SENSITIVITY = 0.005;

export const PROBE = "0".repeat(100);
