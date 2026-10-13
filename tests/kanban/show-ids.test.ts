import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";
import { applyShowIds } from "../../src/cli/source.js";
import { TWO_PANES } from "../support/drawn.js";

const SOURCE = 'kanban\n  todo[Todo]\n    a[Write]\n    b["`**Ship** it`"]@{ ticket: T1 }\n    c\n  done[Done]\n';

describe("kanban under --show-ids", () => {
  it.each(TWO_PANES)("width %i: writes each id into its own title, the board kept to its columns", (width) => {
    const out = render(applyShowIds(SOURCE), { width });
    const top = out.split("\n")[0];
    expect(top.match(/╭/gu)).toHaveLength(2);
    for (const shown of ["todo: Todo", "a: Write", "b: Ship it", "done: Done"]) expect(out).toContain(shown);
    expect(out).not.toContain("c: c");
  });
});
