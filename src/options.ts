import { DEFAULT_CHARSET } from "./canvas/charsets.js";
import type { BorderMode, Declared } from "./source/config.js";

export { BORDER_MODES, type BorderMode } from "./source/config.js";

export const DEFAULT_GAP = 4;
// A row stands for two columns: past the default gap, every two cells of a spacing add a row.
export const rowsPastGap = (cells: number): number => Math.max(0, Math.floor((cells - DEFAULT_GAP) / 2));

export interface RenderOptions {
  charset: string;
  hierarchicalNamespaces: boolean;
  hideEmptyMembersBox: boolean;
  displayMode: "default" | "compact";
  paddingX: number;
  paddingY: number;
  roundedEdges: boolean;
  gap: number;
  // mermaid's `nodeSpacing` and `rankSpacing` read off the source, in cells of the gap's scale: whichever runs
  // across the page takes over from `gap` for the direction drawn, and the other adds rows.
  nodeGap?: number;
  rankGap?: number;
  autoRotate: boolean;
  wrapLabels: boolean;
  airyLabels: boolean;
  snugFrames: boolean;
  autoWrap: boolean;
  compact: boolean;
  mirrorActors: boolean;
  borders: BorderMode;
  bands: number;
  // mermaid's `layout`, the diagram's own `config.<kind>.layout` over the global one.
  layout: string | undefined;
  // mermaid's `look`, `classic`, `handDrawn` or `neo`, read like `layout`, the kind's own default last.
  look: string | undefined;
  // Whether the source or the caller named the look, left undefined until `configured` has read it.
  lookAsked: boolean | undefined;
  // `config.<kind>` as the source wrote it, handed to the kind that owns it: the keys mermaid states per
  // diagram and this reads off the frontmatter or an init directive.
  config: Declared;
}

export const DEFAULT_RENDER: RenderOptions = {
  charset: DEFAULT_CHARSET,
  hierarchicalNamespaces: true,
  hideEmptyMembersBox: false,
  displayMode: "default",
  paddingX: 4,
  paddingY: 2,
  roundedEdges: true,
  gap: DEFAULT_GAP,
  autoRotate: true,
  wrapLabels: false,
  airyLabels: true,
  snugFrames: false,
  autoWrap: true,
  compact: true,
  borders: "default",
  mirrorActors: false,
  bands: 1,
  layout: undefined,
  look: undefined,
  lookAsked: undefined,
  config: {},
};
