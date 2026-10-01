import { asksFill, PROP_FILL, PROP_STROKE } from "../source/css.js";
import { COLOR_THEMES, type Theme, seatIn } from "./theme-model.js";

export interface ColorSlots {
  readonly border: readonly string[];
  readonly fill: readonly string[] | undefined;
}

export interface SlotInks {
  readonly stroke: string;
  readonly fill: string | undefined;
}

export function colorSlotsOf(th: Theme): ColorSlots | undefined {
  const { borderColorArray: border, bkgColorArray: fill } = th.variables;
  if (!COLOR_THEMES.has(th.name) || border === undefined || border.length === 0) return undefined;
  return { border, fill: fill === undefined || fill.length === 0 ? undefined : fill };
}

// `stampColorSlot` and the `genColor` rule it matches: the slot wraps on the border ring, the tint on its own.
export function slotInks(slots: ColorSlots, index: number): SlotInks {
  const slot = index % slots.border.length;
  return { stroke: slots.border[slot], fill: slots.fill === undefined ? undefined : seatIn(slots.fill, slot) };
}

// The slot's `stroke` and `fill` laid UNDER what the element's own `style` and classes write, as mermaid's slot rule
// loses to the inline style.
export function slotted(
  slots: ColorSlots | undefined,
  index: number | undefined,
  own: ReadonlyMap<string, string> | undefined
): ReadonlyMap<string, string> | undefined {
  if (slots === undefined || index === undefined) return own;
  const { stroke, fill } = slotInks(slots, index);
  const laid = new Map<string, string>([[PROP_STROKE, stroke]]);
  if (fill !== undefined && !asksFill(own)) laid.set(PROP_FILL, fill);
  for (const [prop, value] of own ?? []) laid.set(prop, value);
  return laid;
}
