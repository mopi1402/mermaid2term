import { makeNode, type Node, type Subgraph } from "../../graph/model.js";
import { NodeShape, openingOf } from "../../graph/shapes.js";
import { boxLabel, unIconed } from "../../text/labels.js";
import { stripChars } from "../../text/format.js";
import { SEMICOLON } from "../../source/lines.js";
import { insideQuotes, stripQuotes } from "../../source/quotes.js";
import { parseAtShapeProps } from "../../source/shape-data.js";
import { splitStyleClass } from "../../source/css.js";
import { isFenced, parseMarkdownLabel, richSegments, taggedSegments } from "../../source/markdown.js";

// mermaid 12's shape registry, every lowercase name and alias it answers to (`shapes.ts`, `generateShapeMap`).
const AT_SHAPE_MAP: ReadonlyMap<string, NodeShape> = new Map(
  (
    [
      [NodeShape.RECTANGLE, "rect proc process rectangle"],
      [NodeShape.ROUNDED, "rounded event"],
      [NodeShape.STADIUM, "stadium terminal pill"],
      [NodeShape.SUBROUTINE, "fr-rect subprocess subproc framed-rectangle subroutine"],
      [NodeShape.CYLINDER, "cyl db database cylinder lin-cyl disk lined-cylinder bucket"],
      [NodeShape.HORIZONTAL_CYLINDER, "h-cyl das horizontal-cylinder"],
      [NodeShape.DATA_STORE, "datastore data-store"],
      [NodeShape.FOLDER, "folder directory"],
      [NodeShape.CONSOLE, "console"],
      [NodeShape.BROWSER, "browser"],
      [NodeShape.PERSON, "person"],
      [NodeShape.CIRCLE, "circle circ"],
      [NodeShape.DOUBLE_CIRCLE, "dbl-circ double-circle doublecircle"],
      [NodeShape.SMALL_CIRCLE, "sm-circ start small-circle"],
      [NodeShape.FRAMED_CIRCLE, "fr-circ stop framed-circle"],
      [NodeShape.FILLED_CIRCLE, "f-circ junction filled-circle"],
      [NodeShape.CROSSED_CIRCLE, "cross-circ summary crossed-circle"],
      [NodeShape.BANG, "bang"],
      [NodeShape.CLOUD, "cloud"],
      [NodeShape.DIAMOND, "diam decision diamond question"],
      [NodeShape.HEXAGON, "hex hexagon prepare"],
      [NodeShape.PARALLELOGRAM, "lean-r lean-right in-out"],
      [NodeShape.PARALLELOGRAM_ALT, "lean-l lean-left out-in"],
      [NodeShape.TRAPEZOID, "trap-b priority trapezoid-bottom trapezoid"],
      [NodeShape.TRAPEZOID_ALT, "trap-t manual trapezoid-top inv-trapezoid"],
      [NodeShape.TRIANGLE, "tri extract triangle"],
      [NodeShape.FLIPPED_TRIANGLE, "flip-tri manual-file flipped-triangle"],
      [NodeShape.TEXT, "text"],
      [NodeShape.NOTCHED_RECTANGLE, "notch-rect card notched-rectangle"],
      [NodeShape.NOTCHED_PENTAGON, "notch-pent loop-limit notched-pentagon"],
      [NodeShape.SLOPED_RECTANGLE, "sl-rect manual-input sloped-rectangle"],
      [NodeShape.LINED_RECTANGLE, "lin-rect lined-rectangle lined-process lin-proc shaded-process"],
      [NodeShape.DIVIDED_RECTANGLE, "div-rect div-proc divided-rectangle divided-process"],
      [NodeShape.WINDOW_PANE, "win-pane internal-storage window-pane"],
      [NodeShape.STACKED_RECTANGLE, "st-rect procs processes stacked-rectangle"],
      [NodeShape.TAGGED_RECTANGLE, "tag-rect tagged-rectangle tag-proc tagged-process"],
      [NodeShape.DOCUMENT, "doc document"],
      [NodeShape.LINED_DOCUMENT, "lin-doc lined-document"],
      [NodeShape.STACKED_DOCUMENT, "docs documents st-doc stacked-document"],
      [NodeShape.TAGGED_DOCUMENT, "tag-doc tagged-document"],
      [NodeShape.PAPER_TAPE, "flag paper-tape"],
      [NodeShape.STORED_DATA, "bow-rect stored-data bow-tie-rectangle"],
      [NodeShape.DELAY, "delay half-rounded-rectangle"],
      [NodeShape.DISPLAY, "curv-trap curved-trapezoid display"],
      [NodeShape.OUTLINED_BAR, "fork join"],
      [NodeShape.HOURGLASS, "hourglass collate"],
      [NodeShape.LIGHTNING_BOLT, "bolt com-link lightning-bolt"],
      [NodeShape.BRACE_LEFT, "brace comment brace-l"],
      [NodeShape.BRACE_RIGHT, "brace-r"],
      [NodeShape.BRACES, "braces"],
      [NodeShape.ASYMMETRIC, "odd"],
    ] as const
  ).flatMap(([shape, names]) => names.split(" ").map((name): [string, NodeShape] => [name, shape]))
);

export const AT_SHAPE_RE = /^([a-zA-Z_]\w*)\s*@\{([\s\S]+)\}$/;
const COLLAPSED_VIEW = "collapsed";
const PLAIN_ID_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
// mermaid 12's legacy `A[|field:value|text]`: the props are read and dropped, the text alone shown.
const LEGACY_PROPS_RE = /^\|[^\s|:]+:[^\s|]+\|/u;
// A `@{ label }` is markdown unless its `labelType` names plain text; a backtick fence in it is text either way.
const PLAIN_LABEL_TYPES: ReadonlySet<string> = new Set(["string", "text"]);

type NodeReading =
  | { readonly read: "node"; readonly node: Node; readonly shaped: boolean }
  | { readonly read: "box"; readonly box: Subgraph; readonly collapsed: boolean }
  | { readonly read: "none" };

const NONE: NodeReading = { read: "none" };

export function readNode(raw: string, linkIds: ReadonlySet<string>, boxOf: (id: string) => Subgraph | undefined): NodeReading {
  if (raw === "") return NONE;
  const [text, styleClass] = splitStyleClass(stripChars(boxLabel(raw.trim()), SEMICOLON, false, true));
  const styleClasses = styleClass === undefined ? [] : [styleClass];

  const at = AT_SHAPE_RE.exec(text) ?? undefined;
  if (at !== undefined) {
    const id = at[1];
    if (linkIds.has(id)) return NONE;
    const props = parseAtShapeProps(at[2]);
    const box = boxOf(id);
    if (box !== undefined) return { read: "box", box, collapsed: props.get("view") === COLLAPSED_VIEW };
    const shape = AT_SHAPE_MAP.get(props.get("shape") ?? "rect") ?? NodeShape.RECTANGLE;
    const written = unIconed(props.get("label") ?? id);
    const plain = PLAIN_LABEL_TYPES.has(props.get("labelType") ?? "") || isFenced(written);
    const md = plain ? taggedSegments(written) : richSegments(written);
    const node =
      md !== undefined
        ? makeNode(id, md.plain, { shape, styleClasses, labelSegments: md.segments })
        : makeNode(id, written, { shape, styleClasses });
    return { read: "node", node, shaped: true };
  }

  const opening = openingOf(text, insideQuotes);
  if (opening !== undefined) {
    const { id, shape } = opening;
    const rawLabel = shape === NodeShape.RECTANGLE ? opening.label.replace(LEGACY_PROPS_RE, "") : opening.label;
    const fenced = parseMarkdownLabel(rawLabel);
    const bare = unIconed(stripQuotes(rawLabel));
    const md = fenced ?? taggedSegments(bare);
    const node =
      md !== undefined
        ? makeNode(id, md.plain, { shape, styleClasses, labelSegments: md.segments, markdown: fenced !== undefined })
        : makeNode(id, bare, { shape, styleClasses });
    return { read: "node", node, shaped: true };
  }

  let id = text.trim();
  if (id === "" || !PLAIN_ID_RE.test(id)) {
    id = stripQuotes(id);
    if (id === "") return NONE;
  }
  return { read: "node", node: makeNode(id, id, { shape: NodeShape.RECTANGLE, styleClasses }), shaped: false };
}
