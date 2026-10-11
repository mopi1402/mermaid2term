import { announcing } from "../source/source.js";
import type { DiagramKind, GraphKind } from "./@common/kind.js";
import { CLASS_DIAGRAM } from "./classdiagram/kind.js";
import { ER_DIAGRAM } from "./erdiagram/kind.js";
import { FLOWCHART } from "./flowchart/kind.js";
import { GANTT } from "./gantt/kind.js";
import { JOURNEY } from "./journey/kind.js";
import { PACKET } from "./packet/kind.js";
import { PIE } from "./piechart/kind.js";
import { QUADRANT } from "./quadrant/kind.js";
import { SEQUENCE } from "./sequence/kind.js";
import { STATE_DIAGRAM } from "./statediagram/kind.js";
import { TIMELINE } from "./timeline/kind.js";
import { XY_CHART } from "./xychart/kind.js";

const KINDS: readonly DiagramKind[] = [
  SEQUENCE,
  GANTT,
  PIE,
  PACKET,
  XY_CHART,
  JOURNEY,
  TIMELINE,
  QUADRANT,
  CLASS_DIAGRAM,
  ER_DIAGRAM,
];

const GRAPH_KINDS: readonly GraphKind[] = [STATE_DIAGRAM, FLOWCHART];

export const declaredKind = (text: string): DiagramKind | undefined => {
  const head = announcing(text);
  return KINDS.find((kind) => kind.declares(head));
};

export const graphKind = (text: string): GraphKind =>
  GRAPH_KINDS.find((kind) => kind.declares(announcing(text))) ?? FLOWCHART;
