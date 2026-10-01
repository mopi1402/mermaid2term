import { themeRgb } from "../colour/colours.js";
import {
  CHIP_TAIL, EDGE, EDGE_LABEL, GIT_BRANCH_PREFIX, GIT_CHERRY_BULLET, GIT_CHERRY_CAP, GIT_CHERRY_PICK, GIT_COMMIT_LABEL, GIT_COMMIT_PREFIX, GIT_HIGHLIGHT_PREFIX,
  GIT_LINE_PREFIX, GIT_SPINE, GIT_TAG, GIT_TAG_RIM, LABEL, NODE, SUBGRAPH, indexAfter,
} from "../canvas/keys.js";
import { QUIET_RATIO, RULE_RATIO, inkedStyle, readableStyle } from "../colour/contrast.js";
import { formatHex, type RGB } from "../colour/rgb.js";
import { mixRGB } from "../colour/palette.js";
import { firstInk, pageOf } from "./mix.js";
import { textOnFill } from "./labels.js";
import { inked } from "./style.js";
import { MERMAID_THEME_NAMES } from "./mermaid-themes.js";
import { colorSlotsOf } from "./color-slots.js";
import { textOnPage } from "./sections.js";
import { DARK_BACKGROUND, sideOf } from "../colour/background.js";
import { BACKGROUND, DIM, EMPTY } from "./tokens.js";
import { COLOR_THEMES, DARK_THEMES, GIT_INV_NAMES, GIT_LABEL_NAMES, GIT_SEAT_NAMES, NEO_THEMES, REDUX_THEMES, SECTION_SEATS, type Ink, type Theme, seatIn } from "./theme-model.js";

// `.commit-label-bkg { opacity: 0.5 }`: the label's box lets half the page through.
const COMMIT_LABEL_OPACITY = 0.5;
// A branch's bare line, dashed, at a quarter of its ink over the page: there, but behind the commits.
const SPINE_OPACITY = 0.25;

const faded = (th: Theme, style: string): string => {
  const ink = firstInk(style);
  return ink === undefined ? `${DIM} ${style}`.trim() : inkedStyle(style, formatHex(mixRGB(pageOf(th), ink, SPINE_OPACITY)));
};

// `calcColorIndex`: a colour theme keeps seat 0 for the trunk and wraps every other branch on the seats past it.
export const gitSeat = (index: number, limit: number, avoidDefault: boolean): number =>
  avoidDefault && index > 0 ? ((index - 1) % (limit - 1)) + 1 : index % limit;

interface BranchInks {
  readonly commit: Ink;
  readonly highlight: Ink;
  readonly label: Ink;
  readonly band: Ink;
}

// What `.commit{i}` (and `.arrow{i}`), `.commit-highlight{i}`, `.branch-label{i}` and `.label{i}` resolve to for one
// branch: `normalTheme` for the classic five, `genColor` for the neo and redux families.
function branchInks(th: Theme, index: number): BranchInks {
  const v = th.variables;
  const name = th.name;
  const color = COLOR_THEMES.has(name);
  const seat = gitSeat(index, GIT_SEAT_NAMES.length, color);
  const labelSeat = gitSeat(index, REDUX_THEMES.has(name) ? SECTION_SEATS : GIT_SEAT_NAMES.length, color);
  const ci = seat % GIT_SEAT_NAMES.length;
  const li = labelSeat % GIT_SEAT_NAMES.length;
  const git = v[GIT_SEAT_NAMES[ci]];
  const inv = v[GIT_INV_NAMES[ci]];
  if (NEO_THEMES.has(name)) {
    const trunk = seat === 0;
    return { commit: trunk ? v.nodeBorder : git, highlight: trunk ? v.nodeBorder : inv, label: labelSeat === 0 ? v.nodeBorder : v[GIT_LABEL_NAMES[li]], band: v.mainBkg };
  }
  if (color) {
    const ring = colorSlotsOf(th)?.border ?? [];
    const own = (at: number): Ink => (at === 0 || ring.length === 0 ? undefined : seatIn(ring, at));
    const line = own(seat) ?? v.nodeBorder;
    const band = labelSeat === 0 || DARK_THEMES.has(name) ? v.mainBkg : (own(labelSeat) ?? v.mainBkg);
    return { commit: line, highlight: line, label: v.nodeBorder, band };
  }
  if (REDUX_THEMES.has(name)) return { commit: v.nodeBorder, highlight: v.nodeBorder, label: v.nodeBorder, band: v.mainBkg };
  return { commit: git, highlight: inv, label: v[GIT_LABEL_NAMES[li]], band: v[GIT_SEAT_NAMES[li]] };
}

const onPage = (th: Theme, ink: Ink, weight: string, ratio: number): string | undefined => textOnPage(th, ink, weight, ratio, RULE_RATIO);

const onBand = (text: Ink, band: RGB | undefined, weight: string, ratio?: number): string | undefined => {
  const rgb = themeRgb(text);
  if (rgb === undefined || band === undefined) return undefined;
  return textOnFill(inked(weight, formatHex(rgb)), band, ratio, ratio);
};

// The cherry stands on a disc that reads against the page: white on a dark one, black on a light one, where mermaid's
// classic sheets leave it black on both; the neo and redux sheets fill it in `nodeBorder` (11.17.0), which already does.
const CHERRY_BLACK = "#000000";
const CHERRY_WHITE = "#ffffff";

const cherryDisc = (th: Theme, neo: boolean): string => {
  const border = neo ? themeRgb(th.variables.nodeBorder) : undefined;
  if (border !== undefined) return formatHex(border);
  return sideOf(pageOf(th)) === DARK_BACKGROUND ? CHERRY_WHITE : CHERRY_BLACK;
};

// Where no cherry is drawn, its bullet takes the fruit's red instead, weighed to read on the page.
const CHERRY_RED = { r: 0xdc, g: 0x14, b: 0x3c };

const cherryBullet = (th: Theme): string => readableStyle(inked(th.weights.node, formatHex(CHERRY_RED)), pageOf(th), QUIET_RATIO, RULE_RATIO);

// A theme of this package's own keeps the inks every gitGraph was drawn in before: `edge`, `node`, `subgraph`.
export function gitStyles(th: Theme, keys: Iterable<string>, base: ReadonlyMap<string, string>): Array<[string, string]> {
  const own = (key: string): string => base.get(key) ?? EMPTY;
  const ours = !MERMAID_THEME_NAMES.includes(th.name);
  const v = th.variables;
  const w = th.weights;
  const neo = NEO_THEMES.has(th.name) || REDUX_THEMES.has(th.name);
  const tagBand = themeRgb(neo ? v.mainBkg : v.tagLabelBackground);
  const commitBand = neo ? undefined : themeRgb(v.commitLabelBackground);
  const commitInk = neo ? v.nodeBorder : v.commitLabelColor;
  const disc = cherryDisc(th, !ours && neo);
  const styles: Array<[string, string]> = ours
    ? [[GIT_SPINE, faded(th, own(EDGE))], [GIT_CHERRY_PICK, `${own(NODE)} ${BACKGROUND}${disc}`], [GIT_CHERRY_CAP, disc], [GIT_CHERRY_BULLET, cherryBullet(th)], [GIT_TAG, own(EDGE_LABEL)], [GIT_TAG_RIM, own(EDGE_LABEL)], [GIT_COMMIT_LABEL, own(LABEL)]]
    : [
        [GIT_SPINE, faded(th, onPage(th, v.commitLineColor ?? v.lineColor, w.edge, RULE_RATIO) ?? own(EDGE))],
        // Outside the neo and redux sheets no rule fills a cherry-pick; a browser paints it black, this keeps the node's ink.
        [GIT_CHERRY_PICK, `${(neo ? onPage(th, v.nodeBorder, w.node, QUIET_RATIO) : undefined) ?? own(NODE)} ${BACKGROUND}${disc}`],
        [GIT_CHERRY_CAP, disc],
        [GIT_CHERRY_BULLET, cherryBullet(th)],
        [GIT_TAG, onBand(v.tagLabelColor, tagBand, w.edgeLabel) ?? own(EDGE_LABEL)],
        [GIT_TAG_RIM, onBand(neo ? v.nodeBorder : v.tagLabelBorder, tagBand, EMPTY, RULE_RATIO) ?? own(EDGE_LABEL)],
        [
          GIT_COMMIT_LABEL,
          (commitBand === undefined
            ? onPage(th, commitInk, w.label, QUIET_RATIO)
            : onBand(commitInk, mixRGB(pageOf(th), commitBand, COMMIT_LABEL_OPACITY), w.label)) ?? own(LABEL),
        ],
      ];
  const lanes: ReadonlyArray<readonly [string, string, (inks: BranchInks) => string | undefined]> = [
    [GIT_LINE_PREFIX, EDGE, (inks) => onPage(th, inks.commit, w.edge, RULE_RATIO)],
    [GIT_COMMIT_PREFIX, NODE, (inks) => onPage(th, inks.commit, w.node, QUIET_RATIO)],
    [GIT_HIGHLIGHT_PREFIX, NODE, (inks) => onPage(th, inks.highlight, w.node, QUIET_RATIO)],
    [GIT_BRANCH_PREFIX, SUBGRAPH, (inks) => onBand(inks.label, themeRgb(inks.band), w.subgraph)],
  ];
  for (const key of new Set([...keys].map((key) => key.replace(CHIP_TAIL, EMPTY)))) {
    for (const [prefix, fallback, style] of lanes) {
      const index = indexAfter(key, prefix);
      if (index !== undefined) styles.push([key, (ours ? undefined : style(branchInks(th, index))) ?? own(fallback)]);
    }
  }
  return styles;
}
