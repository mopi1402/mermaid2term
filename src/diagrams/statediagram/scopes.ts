import { Graph, labelledNode, makeSubgraph, type Subgraph } from "../../graph/model.js";
import { NodeShape } from "../../graph/shapes.js";
import { must } from "../../must.js";

export class Scopes {
  private readonly stack: Subgraph[] = [];

  constructor(private readonly graph: Graph) {}

  get innermost(): Subgraph | undefined {
    return this.stack[this.stack.length - 1] ?? undefined;
  }

  open(id: string, label: string): void {
    const parent = this.innermost;
    const sg = makeSubgraph(id, label, { parent, composite: true });
    if (parent !== undefined) parent.children.push(sg);
    else this.graph.subgraphs.push(sg);
    this.stack.push(sg);
  }

  close(): void {
    if (this.innermost?.concurrent === true) this.stack.pop();
    this.stack.pop();
  }

  cut(): void {
    const top = this.innermost;
    if (top === undefined) return;
    let composite = top;
    if (top.concurrent) {
      this.stack.pop();
      composite = must(top.parent);
    } else {
      const first = makeSubgraph(`${composite.id}--1`, "", { parent: composite, concurrent: true });
      first.nodeIds = composite.nodeIds;
      first.children = composite.children;
      for (const child of first.children) child.parent = first;
      composite.nodeIds = [];
      composite.children = [first];
    }
    const next = makeSubgraph(`${composite.id}--${composite.children.length + 1}`, "", { parent: composite, concurrent: true });
    composite.children.push(next);
    this.stack.push(next);
  }

  ensureNode(id: string, label: string, shape: NodeShape): void {
    this.graph.addNode(labelledNode(id, label, { shape }));
    const sg = this.innermost;
    if (sg !== undefined && !sg.nodeIds.includes(id)) sg.nodeIds.push(id);
  }
}
