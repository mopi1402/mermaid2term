import { JOURNEY_ACTOR, JOURNEY_BAND_PREFIX, JOURNEY_LEGEND, JOURNEY_SCALE, JOURNEY_SECTION_LABEL_PREFIX, JOURNEY_TITLE, SECTION_BACKGROUND_PREFIX, indexAfter, indexed } from "../canvas/keys.js";
import { colourToHex, themeRgb } from "../colour/colours.js";
import { QUIET_RATIO, inkedStyle, readableStyle } from "../colour/contrast.js";
import { sourceConfig } from "../source/config.js";
import { type Restyle } from "./themecss/model.js";
import { GRID_MIX, baseKey, faintInk, firstInk } from "./mix.js";
import { sectionInks, seatOnPage, textOnPage } from "./sections.js";
import { EMPTY } from "./tokens.js";
import { type Theme, seatIn } from "./theme-model.js";

// mermaid's `journey.actorColours`, the six actor fills; mermaid 12 lets no config or theme variable change them.
const ACTOR_COLOURS = ["#8FBC8F", "#7CFC00", "#00FFFF", "#20B2AA", "#B0E0E6", "#FFFFE0"] as const;

export const JOURNEY_ACTORS = ACTOR_COLOURS.length;

// The score digits are a quiet text on the page, the grid's ink weighed to read there.
const scaleInk = (th: Theme): string => {
  const grid = th.variables.gridColor ?? faintInk(th, GRID_MIX);
  return textOnPage(th, grid, EMPTY, QUIET_RATIO, QUIET_RATIO) ?? grid;
};

export function journeyStyles(th: Theme): Array<[string, string]> {
  return [[JOURNEY_TITLE, th.label], [JOURNEY_LEGEND, th.label], [JOURNEY_SCALE, scaleInk(th)], ...ACTOR_COLOURS.map((colour, at): [string, string] => [indexed(JOURNEY_ACTOR, at), seatOnPage(th, colour, EMPTY, th.node)])];
}

// mermaid 12 writes a section header's words and a task's in `textColor`, their `.label` div's, on the section's fill; a label with
// no ink of its own is the terminal's, which reads on a wash one mix off the page.
export function journeySectionStyles(th: Theme, keys: Iterable<string>): Array<[string, string]> {
  const sections = new Set([...keys].flatMap((key) => indexAfter(baseKey(key), JOURNEY_SECTION_LABEL_PREFIX) ?? []));
  return [...sections].flatMap((n): Array<[string, string]> => {
    const seat = th.sectionColors.length === 0 ? undefined : themeRgb(seatIn(th.sectionColors, n));
    if (seat === undefined) return [];
    const inks = sectionInks(th, seat);
    const label = firstInk(th.label) === undefined ? th.label : readableStyle(th.label, inks.wash);
    return [[SECTION_BACKGROUND_PREFIX + JOURNEY_BAND_PREFIX + n, inks.band], [indexed(JOURNEY_SECTION_LABEL_PREFIX, n), label]];
  });
}

const JOURNEY = "journey";
const TITLE_COLOR = "titleColor";

// mermaid's journey renderer fills its title `config.journey.titleColor`, whichever way the title was written; no
// other kind's config has the key.
const titleInk = (source: string, section: string): string | undefined =>
  section === JOURNEY ? colourToHex(sourceConfig(source, section).section(section)[TITLE_COLOR] ?? "") : undefined;

export const titleRestyles = (source: string, section: string): Restyle[] => {
  const ink = titleInk(source, section);
  return ink === undefined ? [] : [{ keys: (key) => key === JOURNEY_TITLE, ink, ground: undefined, words: [] }];
};

export const titleStyle = (label: string, source: string, section: string): string => {
  const ink = titleInk(source, section);
  return ink === undefined ? label : inkedStyle(label, ink);
};
