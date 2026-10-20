// jscpd:ignore-start: a flat glyph table matches itself one row down once identifiers are ignored
export interface CharSet {
  topLeft: string;
  topRight: string;
  bottomLeft: string;
  bottomRight: string;
  horizontal: string;
  vertical: string;

  roundTopLeft: string;
  roundTopRight: string;
  roundBottomLeft: string;
  roundBottomRight: string;

  heavyTopLeft: string;
  heavyTopRight: string;
  heavyBottomLeft: string;
  heavyBottomRight: string;

  arrowRight: string;
  arrowLeft: string;
  arrowDown: string;
  arrowUp: string;

  lineHorizontal: string;
  lineVertical: string;
  lineDottedH: string;
  lineDottedV: string;
  lineThickH: string;
  lineThickV: string;

  teeRight: string;
  teeLeft: string;
  teeDown: string;
  teeUp: string;

  cross: string;

  diamondTop: string;

  circleEndpoint: string;
  crossEndpoint: string;
  sgTopLeft: string;
  sgTopRight: string;
  sgBottomLeft: string;
  sgBottomRight: string;
  sgHorizontal: string;
  sgVertical: string;

  dblTopLeft: string;
  dblTopRight: string;
  dblBottomLeft: string;
  dblBottomRight: string;
  dblHorizontal: string;
  dblVertical: string;
  floorLeft: string;
  floorRight: string;

  name: string;

  barFull: string;
  // A chart's line in braille dots, where the font holds them; a run of strokes turning on corners otherwise.
  plotDots: boolean;
  // A gantt bar under one of the same ink, an eighth short at its top so the two never read as one block.
  barBelow: string;
  milestone: string;
  barWall: string;
  ruleDashed: string;
  gridLine: string;
  barSplit: string;
  todayMark: string;
  axisUp: string;
  axisRight: string;
  bullet: string;
  point: string;
  sliceFill: string;

  faces: readonly string[];
  actorSymbols: readonly string[];
  commitNormal: string;
  // A merge's mark, mermaid's ring: the branch colour round a pale centre.
  commitMerge: string;
  // A cherry-pick's mark, mermaid's cherry glyph.
  commitCherry: string;
  // The rounded ends a cherry's white ground closes on, a banner's powerline caps; empty where a charset draws none.
  cherryCaps: readonly [left: string, right: string];
  // What a tag's name opens on inside its brackets, mermaid's tag shape; empty where a charset draws none.
  tagIcon: string;
  // A branch's bare line, where no commit stands on it: dashed, as mermaid's `.branch` line.
  spineAcross: string;
  spineDown: string;
  commitReverse: string;
  commitHighlight: string;
  lollipopRing: string;

  lifelineHeavy: string;
  bandFill: string;
  band: BandGlyphs;
  asyncHeadRight: string;
  asyncHeadLeft: string;
  halfHeadFilled: HalfHeads;
  halfHeadStick: HalfHeads;
  crossHead: string;
  actorHead: string;
  boundaryRing: string;
  boundaryPost: string;
  controlMark: string;
  entityMark: string;
  backRule: string;
  backFoot: string;
  backWall: string;

  inheritance: Headed;
  composition: string;
  aggregation: string;

  cardAcross: CardFigures<"right" | "left">;
  cardDown: CardFigures<"down" | "up">;

  slopeRise: string;
  slopeFall: string;
  ruleFloor: string;
  ruleCeiling: string;
  hexPointLeft: string;
  hexPointRight: string;
  flagTip: string;
  hexTipLeft: string;
  hexTipRight: string;
  flagTipSlab: string;
  diamondFilled: string;
  circleMark: string;
  circleMarkFilled: string;
  doubleCircleMark: string;
  smallCircle: string;
  framedCircle: string;
  hourglass: string;
  startState: string;
  choiceMark: string;
  solid: string;
  foldMark: string;
  drum: DrumGlyphs;
  signs: ShapeSigns;
  braceLeft: BraceGlyphs;
  braceRight: BraceGlyphs;
  braceStem: string;
  medallions: readonly string[];
  discDigits: readonly string[];
  icons: ReadonlyMap<string, string>;
}
// jscpd:ignore-end

// The marks a flowchart shape wears where its outline cannot say what it is.
interface ShapeSigns {
  readonly crossedCircle: string;
  readonly bolt: string;
  readonly tagCorner: string;
  readonly prompt: string;
}
interface DrumGlyphs {
  readonly lid: string;
  readonly wall: string;
  readonly foot: string;
  readonly capLid: string;
  readonly capWall: string;
  readonly capFoot: string;
  readonly tie: string;
  readonly undertie: string;
}
interface BraceGlyphs {
  readonly top: string;
  readonly waist: string;
  readonly foot: string;
}

interface Headed {
  readonly down: string;
  readonly up: string;
  readonly right: string;
  readonly left: string;
}
export type Figure = readonly [string, string, string];
interface CardFigures<Side extends string> {
  readonly one: Figure;
  readonly zeroOne: Figure;
  readonly oneMany: Readonly<Record<Side, Figure>>;
  readonly zeroMany: Readonly<Record<Side, Figure>>;
}

interface BandGlyphs {
  readonly top: BandArms;
  readonly bottom: BandArms;
  readonly middle: BandArms;
}
export interface BandArms {
  readonly left: string;
  readonly right: string;
  readonly both: string;
  readonly none: string;
}
interface HalfHeads {
  readonly rightTop: string;
  readonly rightBottom: string;
  readonly leftTop: string;
  readonly leftBottom: string;
}

