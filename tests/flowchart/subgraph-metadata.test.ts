import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";

const drawn = (source: string): string => render(source, { width: 80 });

describe("a subgraph header's `@{ … }` metadata, read off the header as mermaid 12 reads it (#8073)", () => {
  it("draws `subgraph S@{ algorithm: elk.box }` as `subgraph S`, the ELK algorithm saying nothing to a grid", () => {
    const body = "\n    A --> B\n  end\n  C --> S";
    expect(drawn(`flowchart TD\n  subgraph S@{ algorithm: elk.box }${body}`)).toEqual(drawn(`flowchart TD\n  subgraph S${body}`));
  });

  it("titles the frame with a `label` the metadata gives", () => {
    const body = "\n    A --> B\n  end";
    expect(drawn(`flowchart TD\n  subgraph S@{ algorithm: elk.box, label: "Workers" }${body}`)).toEqual(drawn(`flowchart TD\n  subgraph S [Workers]${body}`));
  });
});
