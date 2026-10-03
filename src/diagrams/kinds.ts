import { announcing } from "../source/source.js";
import type { DiagramKind, GraphKind } from "./@common/kind.js";
import { FLOWCHART } from "./flowchart/kind.js";
import { STATE_DIAGRAM } from "./statediagram/kind.js";

const KINDS: readonly DiagramKind[] = [];

const GRAPH_KINDS: readonly GraphKind[] = [STATE_DIAGRAM, FLOWCHART];

export const declaredKind = (text: string): DiagramKind | undefined => {
  const head = announcing(text);
  return KINDS.find((kind) => kind.declares(head));
};

export const graphKind = (text: string): GraphKind =>
  GRAPH_KINDS.find((kind) => kind.declares(announcing(text))) ?? FLOWCHART;
