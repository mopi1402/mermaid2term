import { NOTES } from "@/notes";
import { BOM, familyLabel, familyOf, labelOf } from "@/naming";
import { shelfOf, simpleFirst } from "@/shelves";
import type { Family, Fixture, Shelf, Tab } from "@/model";

const READ = import.meta.glob("../../../fixtures/**/*.mmd", {
  query: "?raw",
  import: "default",
  eager: true,
});

const FIXTURES_DIR = "/fixtures/";

const fixtures: Fixture[] = Object.entries(READ).map(([file, source]) => {
  const name = file.slice(file.indexOf(FIXTURES_DIR) + FIXTURES_DIR.length, -".mmd".length);
  return {
    name,
    label: labelOf(name, familyOf(name, source)),
    source,
    shelf: shelfOf(name),
    notes: NOTES[name],
  };
});

const FAMILY_ORDER = [
  "flowchart",
  "sequenceDiagram",
  "classDiagram",
  "stateDiagram",
  "erDiagram",
  "gantt",
  "gitGraph",
  "mindmap",
  "pie",
  "timeline",
  "xychart",
  "journey",
  "architecture",
  "quadrantChart",
  "kanban",
  "block",
  "packet",
  "treemap",
];

const familyRank = (name: string): number => {
  const rank = FAMILY_ORDER.indexOf(name);
  return rank >= 0 ? rank : FAMILY_ORDER.length;
};

const group = (sources: Fixture[], compare: (a: Fixture, b: Fixture) => number): Family[] => {
  const byFamily = new Map<string, Fixture[]>();
  for (const fixture of sources) {
    const key = familyOf(fixture.name, fixture.source);
    byFamily.set(key, [...(byFamily.get(key) ?? []), fixture]);
  }
  return [...byFamily]
    .sort(([a], [b]) =>
      a === BOM ? 1 : b === BOM ? -1 : familyRank(a) - familyRank(b) || a.localeCompare(b)
    )
    .map(([name, members]) => ({
      name,
      label: familyLabel(name),
      sources: [...members].sort(compare),
    }));
};

const FAMILIES: Family[] = group(fixtures, (a, b) => a.name.localeCompare(b.name));

const showcased = fixtures.filter((one) => one.shelf === "showcase");
const real = fixtures.filter((one) => one.shelf === "real");

const SHOWCASE: Family[] = group(showcased, simpleFirst);
const REAL_LIFE: Family[] = group(real, simpleFirst);

export const TABS: Record<Tab, { label: string; families: Family[]; count: number }> = {
  showcase: { label: "Showcase", families: SHOWCASE, count: showcased.length },
  real: { label: "Real Life", families: REAL_LIFE, count: real.length },
  all: { label: "All", families: FAMILIES, count: fixtures.length },
};

export const BY_NAME = new Map(fixtures.map((fixture) => [fixture.name, fixture]));


const TAB_OF: Record<Shelf, Tab> = { showcase: "showcase", real: "real", control: "all" };

// The tab whose list holds this fixture, and the family it sits under there.
export const placeOf = (name: string | undefined): { tab: Tab; family: string } | undefined => {
  const fixture = name === undefined ? undefined : BY_NAME.get(name);
  return fixture === undefined ? undefined : { tab: TAB_OF[fixture.shelf], family: familyOf(fixture.name, fixture.source) };
};
