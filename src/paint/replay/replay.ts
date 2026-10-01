import { MERMAID_CLASSIC } from "../../tables/mermaid-classic.js";
import { MERMAID_MODERN } from "../../tables/mermaid-modern.js";
import { BARE, type Ink, type StatedInk, type StatedVariables } from "../theme-model.js";
import { SEATS } from "./blocks.js";
import { CLASSIC_PROGRAMS } from "./classic.js";
import { MODERN_PROGRAMS } from "./modern.js";
import { CALCULATED, spent, type Bag } from "./tone.js";

// mermaid's seated lists, each `cScale3` under its own name in a theme file and one list here.
const LISTS = ["cScale", "cScalePeer", "cScaleInv", "cScaleLabel"] as const;
type List = (typeof LISTS)[number];

// The steps a theme file derives through, kept out of what a stylesheet is handed.
const STEPS: ReadonlySet<string> = new Set([
  "border1", "border2", "secondBkg", "mainContrastColor", "darkTextColor", "labelBackground",
  "contrast", "text", "critical", "done", "taskTextLightColor", "pie0",
]);
const SEATED_RE = /^(?:cScale|cScalePeer|cScaleInv|cScaleLabel)\d+$/u;

function bagOf(stated: StatedVariables): Bag {
  const { cScale, cScalePeer, cScaleInv, cScaleLabel, ...rest } = stated;
  const v: Bag = { ...rest };
  const lists: Record<List, readonly Ink[] | undefined> = { cScale, cScalePeer, cScaleInv, cScaleLabel };
  for (const list of LISTS) {
    lists[list]?.forEach((ink, at) => {
      if (ink !== undefined) v[`${list}${at}`] = ink;
    });
  }
  return v;
}

function statedOf(v: Bag): StatedVariables {
  const { darkMode, useGradient, borderColorArray, bkgColorArray, ...paints } = v;
  const inks = Object.entries(paints).flatMap(([name, value]): Array<[string, StatedInk]> => {
    const ink = STEPS.has(name) || SEATED_RE.test(name) ? undefined : spent(value);
    return ink === undefined ? [] : [[name, ink]];
  });
  const seats = (list: List): Ink[] => SEATS.map((at) => {
    const ink = spent(v[`${list}${at}`]);
    return typeof ink === "string" ? ink : undefined;
  });
  return {
    ...Object.fromEntries(inks),
    ...(darkMode === undefined ? {} : { darkMode }),
    ...(useGradient === undefined ? {} : { useGradient }),
    ...(borderColorArray === undefined ? {} : { borderColorArray }),
    ...(bkgColorArray === undefined ? {} : { bkgColorArray }),
    cScale: seats("cScale"),
    cScalePeer: seats("cScalePeer"),
    cScaleInv: seats("cScaleInv"),
    cScaleLabel: seats("cScaleLabel"),
  };
}

interface Program {
  readonly update: (v: Bag) => void;
  // `theme-default.js` runs its `updateColors` once in its constructor, then drops every `calculated` left.
  readonly twice?: boolean;
  // `theme-base.js`'s `calculate`: a written `nodeBorder` turns the gradient off unless the gradient is written too.
  readonly settle?: (v: Bag, written: StatedVariables) => void;
}

const OWN_CALCULATE: ReadonlyMap<string, Omit<Program, "update">> = new Map<string, Omit<Program, "update">>([
  ["default", { twice: true }],
  ["base", {
    settle: (v, written) => {
      if (written.nodeBorder !== undefined && written.useGradient === undefined) v.useGradient = false;
    },
  }],
]);

const PROGRAMS: ReadonlyMap<string, Program> = new Map(
  [...MODERN_PROGRAMS, ...CLASSIC_PROGRAMS].map(([name, update]): [string, Program] => [name, { update, ...OWN_CALCULATE.get(name) }])
);

const CONSTRUCTED: ReadonlyMap<string, Bag> = new Map([...MERMAID_CLASSIC, ...MERMAID_MODERN]);

export const MERMAID_THEME_FILES: readonly string[] = [...CONSTRUCTED.keys()];

const uncalculated = (v: Bag): Bag => ({
  ...v,
  ...Object.fromEntries(Object.entries(v).flatMap(([name, value]) => (value === CALCULATED ? [[name, undefined]] : []))),
});

// mermaid's `getThemeVariables`: the constructor, the written variables over it, `updateColors`, the written ones laid
// back over what it derived.
function replay(program: Program, constructed: Bag, written: StatedVariables): StatedVariables {
  const first: Bag = { ...constructed };
  if (program.twice === true) program.update(first);
  const v = program.twice === true ? uncalculated(first) : first;
  const over = bagOf(written);
  Object.assign(v, over);
  program.update(v);
  Object.assign(v, over);
  program.settle?.(v, written);
  return statedOf(v);
}

// The variables of a mermaid theme with the source's written over it, or nothing for a palette of this page's own.
export function replayed(theme: string, written: StatedVariables): StatedVariables | undefined {
  const program = PROGRAMS.get(theme);
  const constructed = CONSTRUCTED.get(theme);
  return program === undefined || constructed === undefined ? undefined : replay(program, constructed, written);
}

// The flowchart stylesheet reads `nodeTextColor || textColor`: a file that leaves it unset leaves it to the sheet.
const SHEET_FALLBACKS: ReadonlySet<string> = new Set(["nodeTextColor"]);

let baseKeys: readonly string[] | undefined;

// What `theme-base.js` derives and this theme's file leaves unset, bare: nothing is drawn where mermaid gets nothing.
export function leftUnset(stated: StatedVariables): StatedVariables {
  baseKeys ??= Object.keys(replayed("base", {}) ?? {});
  return Object.fromEntries(baseKeys.filter((name) => !(name in stated) && !SHEET_FALLBACKS.has(name)).map((name) => [name, BARE]));
}
