import { LIGHT_BACKGROUND, mirrorRgb, mirrorStandard, type Background } from "../colour/background.js";
import { BRIGHT_FIRST, STANDARD_COLORS, formatHex, parseHex, type RGB } from "../colour/rgb.js";
import {
  BRIGHT_BACKGROUND,
  BRIGHT_FOREGROUND,
  CODE_SEPARATOR,
  SGR_ATTRIBUTES,
  STANDARD_BACKGROUND,
  STANDARD_FOREGROUND,
  truecolorCodes,
} from "./escapes.js";
import { GROUND_WORD, NEGATION_WORD, definitionWords } from "../colour/style-words.js";

const ATTRIBUTE_CODES: readonly string[] = SGR_ATTRIBUTES.map(([, code]) => code);

const SHORT_SPELLINGS: Readonly<Record<string, string>> = {
  b: "bold",
  d: "dim",
  i: "italic",
  u: "underline",
  r: "reverse",
  c: "conceal",
  s: "strike",
  uu: "underline2",
  o: "overline",
};
const bitOf = (name: string): number => {
  const bit = SGR_ATTRIBUTES.findIndex(([known]) => known === name);
  if (bit < 0) throw new Error(`ansi: ${name} is not an attribute`);
  return bit;
};
const ATTRIBUTE_BITS: ReadonlyMap<string, number> = new Map([
  ...SGR_ATTRIBUTES.map(([name], bit): [string, number] => [name, bit]),
  ...Object.entries(SHORT_SPELLINGS).map(([short, name]): [string, number] => [short, bitOf(name)]),
]);


type Color = { readonly kind: "standard"; readonly index: number } | { readonly kind: "truecolor"; readonly rgb: RGB };

function parseColor(word: string): Color {
  const index = STANDARD_COLORS.indexOf(word);
  if (index >= 0) return { kind: "standard", index };
  const rgb = parseHex(word);
  if (rgb !== undefined) return { kind: "truecolor", rgb };
  throw new Error(`ansi: ${word} is not a colour a style may name`);
}

function colorCodes(color: Color, foreground: boolean): string[] {
  if (color.kind === "truecolor") return truecolorCodes(color.rgb, foreground);
  const bright = color.index >= BRIGHT_FIRST;
  const base = bright
    ? foreground
      ? BRIGHT_FOREGROUND
      : BRIGHT_BACKGROUND
    : foreground
      ? STANDARD_FOREGROUND
      : STANDARD_BACKGROUND;
  return [String(base + (color.index - (bright ? BRIGHT_FIRST : 0)))];
}

const mirrored = (color: Color, background: Background | undefined): Color => {
  if (background !== LIGHT_BACKGROUND) return color;
  return color.kind === "truecolor"
    ? { kind: "truecolor", rgb: mirrorRgb(color.rgb) }
    : { kind: "standard", index: mirrorStandard(color.index) };
};

export function mirrorDefinition(definition: string, towards?: Background): string {
  return definitionWords(definition)
    .map((word) => {
      const lower = word.toLowerCase();
      if (lower === GROUND_WORD || lower === NEGATION_WORD || ATTRIBUTE_BITS.has(lower)) return word;
      const index = STANDARD_COLORS.indexOf(lower);
      if (index >= 0) return STANDARD_COLORS[mirrorStandard(index)];
      const rgb = parseHex(lower);
      return rgb === undefined ? word : formatHex(mirrorRgb(rgb, towards));
    })
    .join(" ");
}

export function styleCodes(definition: string, background?: Background): string {
  const words = definitionWords(definition);
  const set = new Set<number>();
  let color: Color | undefined;
  let bgcolor: Color | undefined;

  for (let i = 0; i < words.length; i++) {
    const word = words[i].toLowerCase();
    if (word === GROUND_WORD) {
      const next = words[++i];
      if (next === undefined) throw new Error("ansi: `on` was written with no colour after it");
      bgcolor = parseColor(next.toLowerCase());
    } else if (word === NEGATION_WORD) {
      const next = words[++i];
      if (next === undefined) throw new Error("ansi: `not` was written with no attribute after it");
      const bit = ATTRIBUTE_BITS.get(next.toLowerCase());
      if (bit === undefined) throw new Error(`ansi: ${next} is not an attribute`);
      set.delete(bit);
    } else {
      const bit = ATTRIBUTE_BITS.get(word);
      if (bit !== undefined) set.add(bit);
      else color = parseColor(word);
    }
  }

  const codes: string[] = [];
  for (let bit = 0; bit < ATTRIBUTE_CODES.length; bit++) {
    if (set.has(bit)) codes.push(ATTRIBUTE_CODES[bit]);
  }
  if (color !== undefined) codes.push(...colorCodes(mirrored(color, background), true));
  if (bgcolor !== undefined) codes.push(...colorCodes(mirrored(bgcolor, background), false));
  return codes.join(CODE_SEPARATOR);
}
