export const NONE = 0;
export const LIGHT = 1;
export const HEAVY = 2;
export const DOUBLE = 3;
const WEIGHTS = [NONE, LIGHT, HEAVY, DOUBLE] as const;
export type Weight = (typeof WEIGHTS)[number];

export type Arms = readonly [Weight, Weight, Weight, Weight];

const keyOf = (arms: Arms): string => arms.join("");

export const GLYPH_BY_ARMS: ReadonlyMap<string, string> = new Map([
  ["0001", "\u2577"],
  ["0002", "\u257b"],
  ["0010", "\u2575"],
  ["0011", "\u2502"],
  ["0012", "\u257d"],
  ["0020", "\u2579"],
  ["0021", "\u257f"],
  ["0022", "\u2503"],
  ["0033", "\u2551"],
  ["0100", "\u2576"],
  ["0101", "\u250c"],
  ["0102", "\u250e"],
  ["0103", "\u2553"],
  ["0110", "\u2514"],
  ["0111", "\u251c"],
  ["0112", "\u251f"],
  ["0120", "\u2516"],
  ["0121", "\u251e"],
  ["0122", "\u2520"],
  ["0130", "\u2559"],
  ["0133", "\u255f"],
  ["0200", "\u257a"],
  ["0201", "\u250d"],
  ["0202", "\u250f"],
  ["0210", "\u2515"],
  ["0211", "\u251d"],
  ["0212", "\u2522"],
  ["0220", "\u2517"],
  ["0221", "\u2521"],
  ["0222", "\u2523"],
  ["0301", "\u2552"],
  ["0303", "\u2554"],
  ["0310", "\u2558"],
  ["0311", "\u255e"],
  ["0330", "\u255a"],
  ["0333", "\u2560"],
  ["1000", "\u2574"],
  ["1001", "\u2510"],
  ["1002", "\u2512"],
  ["1003", "\u2556"],
  ["1010", "\u2518"],
  ["1011", "\u2524"],
  ["1012", "\u2527"],
  ["1020", "\u251a"],
  ["1021", "\u2526"],
  ["1022", "\u2528"],
  ["1030", "\u255c"],
  ["1033", "\u2562"],
  ["1100", "\u2500"],
  ["1101", "\u252c"],
  ["1102", "\u2530"],
  ["1103", "\u2565"],
  ["1110", "\u2534"],
  ["1111", "\u253c"],
  ["1112", "\u2541"],
  ["1120", "\u2538"],
  ["1121", "\u2540"],
  ["1122", "\u2542"],
  ["1130", "\u2568"],
  ["1133", "\u256b"],
  ["1200", "\u257c"],
  ["1201", "\u252e"],
  ["1202", "\u2532"],
  ["1210", "\u2536"],
  ["1211", "\u253e"],
  ["1212", "\u2546"],
  ["1220", "\u253a"],
  ["1221", "\u2544"],
  ["1222", "\u254a"],
  ["2000", "\u2578"],
  ["2001", "\u2511"],
  ["2002", "\u2513"],
  ["2010", "\u2519"],
  ["2011", "\u2525"],
  ["2012", "\u252a"],
  ["2020", "\u251b"],
  ["2021", "\u2529"],
  ["2022", "\u252b"],
  ["2100", "\u257e"],
  ["2101", "\u252d"],
  ["2102", "\u2531"],
  ["2110", "\u2535"],
  ["2111", "\u253d"],
  ["2112", "\u2545"],
  ["2120", "\u2539"],
  ["2121", "\u2543"],
  ["2122", "\u2549"],
  ["2200", "\u2501"],
  ["2201", "\u252f"],
  ["2202", "\u2533"],
  ["2210", "\u2537"],
  ["2211", "\u253f"],
  ["2212", "\u2548"],
  ["2220", "\u253b"],
  ["2221", "\u2547"],
  ["2222", "\u254b"],
  ["3001", "\u2555"],
  ["3003", "\u2557"],
  ["3010", "\u255b"],
  ["3011", "\u2561"],
  ["3030", "\u255d"],
  ["3033", "\u2563"],
  ["3300", "\u2550"],
  ["3301", "\u2564"],
  ["3303", "\u2566"],
  ["3310", "\u2567"],
  ["3311", "\u256a"],
  ["3330", "\u2569"],
  ["3333", "\u256c"],]);

const weightOf = (digit: string): Weight => {
  const weight = WEIGHTS.find((w) => w === Number(digit));
  if (weight === undefined) throw new Error(`no weight is written ${digit}`);
  return weight;
};
const armsOfKey = (key: string): Arms => [weightOf(key[0]), weightOf(key[1]), weightOf(key[2]), weightOf(key[3])];
export const mapArms = (arms: Arms, change: (weight: Weight, index: number) => Weight): Arms =>
  [change(arms[0], 0), change(arms[1], 1), change(arms[2], 2), change(arms[3], 3)];
export const heaviest = (weights: readonly Weight[]): Weight => weights.reduce<Weight>((heavy, w) => (w > heavy ? w : heavy), NONE);

export const ARMS_BY_GLYPH: ReadonlyMap<string, Arms> = new Map(
  [...GLYPH_BY_ARMS].map(([key, glyph]) => [glyph, armsOfKey(key)])
);

export function weightedGlyph(arms: Arms): string | undefined {
  return GLYPH_BY_ARMS.get(keyOf(arms)) ?? undefined;
}

export function plain(l: Weight, r: Weight, u: Weight, d: Weight): string {
  const glyph = GLYPH_BY_ARMS.get(keyOf([l, r, u, d]));
  if (glyph === undefined) throw new Error(`no box-drawing glyph carries the arms ${l}${r}${u}${d}`);
  return glyph;
}
