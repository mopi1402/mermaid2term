import { afterEach, describe, expect, it } from "vitest";

import { render } from "../../src/index.js";
import { initConfig } from "../../src/source/directives.js";

const FLOW = "flowchart TD\n  A --> B\n";
const POLLUTED = "polluted";
const probe = (): unknown => Reflect.get({}, POLLUTED);

// mermaid 12's `sanitizeDirective` deletes `__`, `proto` and `constr` keys before any merge.
describe("init directives never reach Object.prototype", () => {
  afterEach(() => {
    Reflect.deleteProperty(Object.prototype, POLLUTED);
  });

  it("drops a top-level __proto__ when two directives merge", () => {
    render('%%{init: {}}%%\n%%{init: {"__proto__": {"polluted": "yes"}}}%%\n' + FLOW);
    expect(probe()).toBeUndefined();
  });

  it("drops a __proto__ under a section when two directives merge", () => {
    render("%%{init: {}}%%\n%%{init: {'flowchart': {'__proto__': {'polluted': 1}}}}%%\n" + FLOW);
    expect(probe()).toBeUndefined();
  });

  it("drops constructor and prototype keys from the read config", () => {
    const read = initConfig('%%{init: {"constructor": {"prototype": {"polluted": 1}}, "flowchart": {"__proto__": {"a": 1}, "wrap": true}}}%%\n' + FLOW);
    expect(read).toEqual({ flowchart: { wrap: true } });
  });
});
