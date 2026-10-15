import { Direction, Graph, makeEdge, makeNode, makeSubgraph, type Subgraph } from "../../graph/model.js";
import { NodeShape } from "../../graph/shapes.js";
import { WORD_CHAR, WORD_CHARS, words } from "../../text/format.js";
import { contentLines, headerBody } from "../../source/lines.js";
import { withoutAccessible } from "../@common/accessible.js";
import { stripQuotes } from "../../source/quotes.js";
import { UNICODE } from "../../canvas/charsets.js";
import { must, oneOf } from "../../must.js";
import { SIDES, type ArchitectureModel, type Hint, type Seat, type Side } from "./model.js";
import { layOutArchitecture } from "./layout.js";
import { boxLabel, lineLabel } from "../../text/labels.js";

const WORD = WORD_CHAR;
// mermaid's `ID`, `[\w]([-\w]*\w)?`: a hyphen inside, never at either end.
const ID = String.raw`${WORD}(?:[-${WORD_CHARS}]*${WORD})?`;
const ICON = String.raw`(?:\s*\(([^)]*)\))?`;
const TITLE = String.raw`(?:\s*\[([^\]]*)\])?`;
const PARENT = String.raw`(?:\s+in\s+(${ID}))?`;
const END = String.raw`(${ID})(?:\s*\{(${WORD}+)\})?`;

const HEADER_RE = /^architecture(?:-beta)?(?=\s|$)/u;
const GROUP_RE = new RegExp(String.raw`^group\s+(${ID})${ICON}${TITLE}${PARENT}`, "u");
const SERVICE_RE = new RegExp(String.raw`^service\s+(${ID})(?:\s*"([^"]*)"|${ICON})${TITLE}${PARENT}`, "u");
const JUNCTION_RE = new RegExp(String.raw`^junction\s+(${ID})${PARENT}`, "u");
const HINTED_EDGE_RE = new RegExp(
  String.raw`^${END}\s*:\s*([LRTB])\s*([<>]?)\s*(?:--|-\s*\[([^\]]*)\]\s*-)\s*([<>]?)\s*([LRTB])\s*:\s*${END}`,
  "u"
);
const PLAIN_EDGE_RE = new RegExp(String.raw`^(${ID})\s*(<?)--(-?)(>?)\s*(${ID})`, "u");
const ALIGN_RE = new RegExp(String.raw`^align\s+(row|column)((?:\s+${ID}){2,})\s*$`, "u");

const ARROW_START = "<";
const ARROW_END = ">";
const ALIGN_ROW = "row";

const labelOf = (prefix: string, title: string): string => (title === "" ? prefix.trimEnd() : prefix + title);

function readArchitecture(text: string, icons: Readonly<Record<string, string>>): ArchitectureModel {
  const lines = contentLines(text);
  const graph = new Graph();
  graph.direction = Direction.TB;
  const groups = new Map<string, Subgraph>();
  const hints: Hint[] = [];
  const aligned: Seat[] = [];
  const nodeIds: string[] = [];
  const junctionIds = new Set<string>();
  const model = { graph, groups, hints, aligned, nodeIds, junctionIds };
  if (lines.length === 0) return model;

  const place = (id: string, parentId: string | undefined): void => {
    nodeIds.push(id);
    const parent = parentId === undefined ? undefined : groups.get(parentId);
    if (parent !== undefined) parent.nodeIds.push(id);
  };

  // mermaid reads a statement on the header line too: `architecture-beta service a(server)[A]`.
  for (const stripped of withoutAccessible(headerBody(lines, HEADER_RE))) {

    const group = GROUP_RE.exec(stripped) ?? undefined;
    if (group !== undefined) {
      const id = group[1];
      const sg = makeSubgraph(id, labelOf(icons[group[2] ?? ""] ?? "", boxLabel(group[3] ?? "")), { titleLeft: true });
      const parent = group[4] === undefined ? undefined : groups.get(group[4]);
      if (parent !== undefined) {
        parent.children.push(sg);
        sg.parent = parent;
      } else {
        graph.subgraphs.push(sg);
      }
      groups.set(id, sg);
      continue;
    }

    const service = SERVICE_RE.exec(stripped) ?? undefined;
    if (service !== undefined) {
      const id = service[1];
      const icon = service[2] === undefined ? icons[service[3] ?? ""] ?? "" : `${service[2]} `;
      graph.addNode(makeNode(id, labelOf(icon, boxLabel(service[4] ?? "")), { shape: NodeShape.RECTANGLE }));
      place(id, service[5]);
      continue;
    }

    const junction = JUNCTION_RE.exec(stripped) ?? undefined;
    if (junction !== undefined) {
      const id = junction[1];
      graph.addNode(makeNode(id, "", { shape: NodeShape.JUNCTION }));
      junctionIds.add(id);
      place(id, junction[2]);
      continue;
    }

    const hinted = HINTED_EDGE_RE.exec(stripped) ?? undefined;
    if (hinted !== undefined) {
      const source = hinted[1];
      const target = hinted[8];
      // `ARROW_INTO` is `<` or `>` alike: either sets a head on the end it is written by.
      const headAtSource = hinted[4] !== "";
      const headAtTarget = hinted[6] !== "";
      graph.addEdge(
        makeEdge(source, target, {
          hasArrowStart: headAtSource,
          hasArrowEnd: headAtTarget,
          label: lineLabel(stripQuotes(hinted[5] ?? "")),
        })
      );
      hints.push({
        source,
        sourceSide: must(oneOf(SIDES, hinted[3])),
        target,
        targetSide: must(oneOf(SIDES, hinted[7])),
        headAtSource,
        headAtTarget,
      });
      continue;
    }

    const align = ALIGN_RE.exec(stripped) ?? undefined;
    if (align !== undefined) {
      const members = words(align[2]);
      const side: Side = align[1] === ALIGN_ROW ? "R" : "B";
      for (let at = 1; at < members.length; at++) aligned.push([members[at - 1], side, members[at], true]);
      continue;
    }

    const plain = PLAIN_EDGE_RE.exec(stripped) ?? undefined;
    if (plain !== undefined) {
      graph.addEdge(
        makeEdge(plain[1], plain[5], {
          hasArrowStart: plain[2] === ARROW_START,
          hasArrowEnd: plain[4] === ARROW_END,
        })
      );
    }
  }

  return model;
}

export function parseArchitecture(text: string, icons: Readonly<Record<string, string>> = UNICODE.icons): Graph {
  return layOutArchitecture(readArchitecture(text, icons));
}
