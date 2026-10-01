// What a shape's `fill` paints here: the ink of the glyphs that draw it, the ground under its cells, nothing for a
// frame drawn alone or a line, which its `stroke` inks, and nothing for an HTML label, which only its `color` inks.
export type FillReach = "ink" | "ground" | "none" | "html";

// A property a rule writes that mermaid 12 was measured not to show on what this entry draws. `bold` is the weight
// alone, `italic` the style alone, `font` every font word.
export type Unread = "fill" | "stroke" | "color" | "bold" | "italic" | "font";

// A selector mermaid lays on a kind's SVG, measured to reach its element past mermaid's own rules, and the palette
// keys that draw that element here.
export interface KindSelector {
  readonly selectors: readonly string[];
  readonly keys: (key: string) => boolean;
  readonly fill: FillReach;
  readonly unread?: readonly Unread[];
}

export interface Restyle {
  readonly keys: (key: string) => boolean;
  readonly ink: string | undefined;
  readonly ground: string | undefined;
  readonly words: readonly string[];
}
