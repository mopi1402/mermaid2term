import { expect } from "vitest";
import { unaskedGround } from "../scripts/unasked.js";

unaskedGround();

interface StringMatchers<R = unknown> {
  toStartWith(prefix: string): R;
  toEndWith(suffix: string): R;
}

declare module "vitest" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-object-type
  interface Assertion<T = any> extends StringMatchers<void> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining extends StringMatchers {}
}

expect.extend({
  toStartWith(received: unknown, prefix: string) {
    const pass = typeof received === "string" && received.startsWith(prefix);
    return {
      pass,
      message: () => `expected ${JSON.stringify(received)} ${pass ? "not " : ""}to start with ${JSON.stringify(prefix)}`,
    };
  },
  toEndWith(received: unknown, suffix: string) {
    const pass = typeof received === "string" && received.endsWith(suffix);
    return {
      pass,
      message: () => `expected ${JSON.stringify(received)} ${pass ? "not " : ""}to end with ${JSON.stringify(suffix)}`,
    };
  },
});
