import type { Graph } from "../../graph/model.js";
import { firstWords } from "../../source/lines.js";
import { parseCssProps } from "../../source/css.js";

/**
 * `style <ids> <properties>`, the statement the flowchart and the state grammars share. `listed` is the state
 * grammar's own `STYLE_IDS` (`[\w,]+`), where the flowchart's rule names a single node. flowDb merges a second line
 * on one node into the first; stateDb sets the state's styles outright.
 */
export function readStyle(graph: Graph, line: string, listed = false): void {
  const parts = firstWords(line, 2);
  if (parts.length < 3) return;
  const props = parseCssProps(parts[2]);
  if (!listed) {
    graph.nodeStyles.set(parts[1], new Map([...(graph.nodeStyles.get(parts[1]) ?? []), ...props]));
    return;
  }
  for (const raw of parts[1].split(",")) {
    const id = raw.trim();
    if (id !== "") graph.nodeStyles.set(id, new Map(props));
  }
}
