import { charsetOf } from "../../canvas/charsets.js";
import { DEFAULT_RENDER } from "../../options.js";
import { declaredIn, kind, onCanvas } from "../@common/kind.js";
import { parseMindmap } from "./parser.js";
import { renderMindmap } from "./render.js";

// The layout mermaid's `@mermaid-js/layout-tidy-tree` registers: the root's branches on its two sides alone.
const TIDY_TREE = "tidy-tree";

export const MINDMAP = kind("mindmap", (text, o, budget, _direction, painting) =>
  onCanvas(
    renderMindmap(
      parseMindmap(text, declaredIn(o)),
      charsetOf(o.charset),
      o.roundedEdges ?? true,
      budget,
      o.autoRotate ?? DEFAULT_RENDER.autoRotate,
      painting?.rootFilled ?? false,
      // The fit asks for no vertical air once the drawing runs past the height it was given.
      o.paddingY === 0,
      o.layout === TIDY_TREE
    )
  )
);
