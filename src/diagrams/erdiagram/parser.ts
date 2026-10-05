import {
  makeERDiagram,
  makeEntity,
  makeGroup,
  groupOf,
  displayName,
  type Entity,
  type EntityGroup,
  type ERDiagram,
  type Relationship,
} from "./model.js";
import { generics } from "../@common/generics.js";
import { CLASS_RE, CLASSDEF_RE, defineClasses, parseCssProps, STYLE_RE } from "../../source/css.js";
import { DIRECTION_ANYWHERE_RE, braceBody } from "../@common/box-diagram.js";
import { applyRules, type LineRule } from "../@common/rules.js";
import { withoutAccessible } from "../@common/accessible.js";
import { type Declared } from "../../source/config.js";
import { FRONTMATTER_FENCE, headerTail, uncommentedPastBrackets } from "../../source/lines.js";
import { QUOTE } from "../../source/quotes.js";
import { stripChars } from "../../text/format.js";
import { ensured, must } from "../../must.js";
import { NEWLINE } from "../../text/chars.js";
import { boxLabel, lineLabel } from "../../text/labels.js";
import { Direction, directionOf } from "../../graph/model.js";
import { CSS_MARK_RE, END_RE, ENTITY_BRACE_RE, ENTITY_INLINE_BRACE_RE, ENTITY_STANDALONE_RE, HEADER_RE, KEYWORDS, SUBGRAPH_RE, attributesOf, entityName, relationshipOf, styleOf } from "./patterns.js";
import { relationLabel } from "../../source/markdown.js";

const ensureEntity = (diagram: ERDiagram, name: string): Entity => ensured(diagram.entities, name, makeEntity);

function related(diagram: ERDiagram, relationship: Relationship): Relationship {
  ensureEntity(diagram, relationship.entity1);
  ensureEntity(diagram, relationship.entity2);
  return relationship;
}

// mermaid writes the same four directions two ways, `TD` standing for `TB`, and reads them from a statement and
// from `config.er.layoutDirection` alike.
const facing = (written: string): Direction | undefined => directionOf(written, true);

// What the lines read so far have opened, and where the next one stands (an entity body moves it past its `}`).
interface Reading {
  readonly diagram: ERDiagram;
  readonly lines: readonly string[];
  next: number;
  readonly open: EntityGroup[];
  // The entities a group already holds: an entity joins the first group that names it.
  readonly grouped: Set<string>;
  // `style` and `class` lines, applied once every entity and group is known.
  readonly styleLines: Array<readonly [string, Map<string, string>]>;
  readonly classLines: Array<readonly [string, string[]]>;
}

function claim({ open, grouped }: Reading, name: string): void {
  const inner = open[open.length - 1];
  if (inner === undefined || grouped.has(name)) return;
  inner.entities.push(name);
  grouped.add(name);
}

// An entity a line names, claimed by the open group, its alias taken where the line writes one.
function entityNamed(reading: Reading, found: RegExpExecArray): Entity {
  const name = entityName(found[1], found[2]);
  claim(reading, name);
  const entity = ensureEntity(reading.diagram, name);
  const alias = stripChars(found[3] ?? "", QUOTE);
  if (alias !== "") entity.alias = alias;
  return entity;
}

// `:::` and its classes come off each entity the line marks; what stood before it is the statement, alias and all.
function unmarked({ diagram }: Reading, line: string): string {
  return line.replace(CSS_MARK_RE, (whole: string, quoted: string | undefined, bare: string | undefined, alias: string | undefined, list: string) => {
    const name = entityName(quoted, bare);
    const entity = ensureEntity(diagram, name);
    for (const cls of list.split(",")) entity.cssClasses.push(cls.trim());
    if (alias !== undefined) entity.alias = stripChars(alias, QUOTE);
    return whole.slice(0, whole.length - `:::${list}`.length);
  });
}

const CLOSING_BRACE_RE = /^\}$/u;

// The lines read before a line's `:::` marks come off, in the order they are tried.
const STYLING: ReadonlyArray<LineRule<Reading>> = [
  { pattern: CLOSING_BRACE_RE, apply: () => undefined },
  { pattern: CLASSDEF_RE, apply: ({ diagram }, found) => defineClasses(diagram.classDefs, found[1], parseCssProps(found[2])) },
  // `class A,B c1,c2`, mermaid's `CLASS idList idList`, which names entities and subgraphs alike.
  {
    pattern: CLASS_RE,
    apply: ({ classLines }, found) => {
      for (const name of found[1].split(",")) classLines.push([name.trim(), found[2].split(",").map((cls) => cls.trim())]);
    },
  },
  {
    pattern: STYLE_RE,
    apply: ({ styleLines }, found) => {
      const props = parseCssProps(found[2]);
      for (const name of found[1].split(",")) styleLines.push([name.trim(), props]);
    },
  },
];

// The group statements, read on the line with its marks off.
const GROUPS: ReadonlyArray<LineRule<Reading>> = [
  {
    pattern: DIRECTION_ANYWHERE_RE,
    apply: ({ diagram, open }, found) => {
      const normalized = must(facing(found[1].toUpperCase()));
      const inner = open[open.length - 1];
      if (inner !== undefined) inner.direction = normalized;
      else {
        diagram.direction = normalized;
        diagram.directionDeclared = true;
      }
    },
  },
  {
    pattern: SUBGRAPH_RE,
    apply: ({ diagram, open }, found) => {
      const id = (found[1] ?? found[2] ?? "").trim();
      const title = stripChars((found[3] ?? "").trim(), QUOTE);
      const group = makeGroup(id, title === "" ? id : title);
      const parent = open[open.length - 1];
      if (parent === undefined) diagram.groups.push(group);
      else parent.children.push(group);
      open.push(group);
    },
  },
  {
    pattern: END_RE,
    apply: ({ diagram, open }, _found, line) => {
      if (open.length > 0) open.pop();
      else diagram.warnings.push(`Unrecognized line: ${JSON.stringify(line)}`);
    },
  },
];

// The entity statements, read after the relationship, which opens exactly like a standalone entity line.
const ENTITIES: ReadonlyArray<LineRule<Reading>> = [
  {
    pattern: ENTITY_BRACE_RE,
    apply: (reading, found) => {
      const entity = entityNamed(reading, found);
      const block = braceBody(reading.lines, reading.next);
      reading.next = block.next;
      for (const body of block.rows) entity.attributes.push(...attributesOf(body));
    },
  },
  // `CUSTOMER {}` and `CUSTOMER { string name }`: mermaid skips every blank inside a block, a newline included,
  // so a block opened and closed on one row is the same statement.
  { pattern: ENTITY_INLINE_BRACE_RE, apply: (reading, found) => entityNamed(reading, found).attributes.push(...attributesOf(found[4])) },
  {
    pattern: ENTITY_STANDALONE_RE,
    apply: (reading, found) => {
      if (!KEYWORDS.has(entityName(found[1], found[2]).toLowerCase())) entityNamed(reading, found);
    },
  },
];

function readLine(reading: Reading, line: string): void {
  if (applyRules(STYLING, reading, line)) return;
  const stripped = unmarked(reading, line);
  if (applyRules(GROUPS, reading, stripped)) return;
  const spec = relationshipOf(stripped);
  if (spec !== undefined) {
    claim(reading, spec.entity1);
    claim(reading, spec.entity2);
    reading.diagram.relationships.push(
      related(reading.diagram, {
        entity1: spec.entity1,
        entity2: spec.entity2,
        card1: spec.card1,
        card2: spec.card2,
        lineStyle: styleOf(spec.line),
        ...relationLabel(lineLabel(stripChars(spec.label.trim(), QUOTE))),
      })
    );
    return;
  }
  if (!applyRules(ENTITIES, reading, stripped)) reading.diagram.warnings.push(`Unrecognized line: ${JSON.stringify(stripped)}`);
}

export function parseERDiagram(text: string, said: Declared = {}): ERDiagram {
  const diagram = makeERDiagram();
  // `layoutDirection` is the `direction` statement written in the config, and it counts as declared: a drawing
  // the source asked to lay out one way is not turned by the fitting.
  const laid = facing((said["layoutDirection"] ?? "").toUpperCase());
  if (laid !== undefined) {
    diagram.direction = laid;
    diagram.directionDeclared = true;
  }
  const lines = withoutAccessible(text.split(NEWLINE).map(uncommentedPastBrackets));
  const reading: Reading = { diagram, lines, next: 0, open: [], grouped: new Set(), styleLines: [], classLines: [] };
  const { styleLines, classLines } = reading;

  while (reading.next < lines.length) {
    const stripped = headerTail(lines[reading.next], HEADER_RE) ?? lines[reading.next].trim();
    reading.next += 1;
    if (stripped === "" || stripped === FRONTMATTER_FENCE) continue;
    readLine(reading, stripped);
  }

  const groupIds = new Set<string>();
  const gatherIds = (groups: EntityGroup[]): void => {
    for (const group of groups) {
      groupIds.add(group.id);
      gatherIds(group.children);
    }
  };
  gatherIds(diagram.groups);
  const withdraw = (groups: EntityGroup[], name: string): void => {
    for (const group of groups) {
      group.entities = group.entities.filter((held) => held !== name);
      withdraw(group.children, name);
    }
  };
  for (const id of groupIds) {
    const entity = diagram.entities.get(id);
    if (entity === undefined || entity.attributes.length > 0 || entity.alias !== "") continue;
    diagram.entities.delete(id);
    withdraw(diagram.groups, id);
  }

  for (const [name, props] of styleLines) {
    const entity = diagram.entities.get(name);
    if (entity !== undefined) for (const [prop, value] of props) entity.styles.set(prop, value);
    const group = groupOf(diagram.groups, name);
    if (group !== undefined) for (const [prop, value] of props) group.styles.set(prop, value);
  }

  for (const [name, classes] of classLines) {
    const entity = diagram.entities.get(name);
    if (entity !== undefined) entity.cssClasses.push(...classes);
    const group = groupOf(diagram.groups, name);
    if (group !== undefined) group.cssClasses.push(...classes);
  }

  // The name goes through `addText` like every cell of a row, so a quoted `"Box~T~"` is drawn `Box<T>`. It is
  // written into the alias and never over the name, which is the key every relationship names its ends by.
  for (const entity of diagram.entities.values()) {
    const shown = displayName(entity);
    const bracketed = generics(boxLabel(shown));
    if (bracketed !== shown) entity.alias = bracketed;
  }

  return diagram;
}

