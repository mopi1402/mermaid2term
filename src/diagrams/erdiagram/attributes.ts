import { SPACE } from "../../text/chars.js";
import {
  displayName,
  type Attribute,
  type Entity,
} from "./model.js";
import { shownWidth, widestShown } from "../../source/markdown.js";
import { labelRowsOf } from "../../text/labels.js";
import { CELL_COUNT, TRAILING_BLANKS_RE, TYPE_PIPE } from "./metrics.js";

const COMMENT_CELL = CELL_COUNT - 1;

function attributeCells(attr: Attribute): string[] {
  return [attr.type, attr.name, attr.keys.join(","), attr.comment];
}

// An attribute's rows: its comment takes one per `<br>`, the other cells standing on the first.
export function attributeRows(attr: Attribute): string[][] {
  const cells = attributeCells(attr);
  return labelRowsOf(cells[COMMENT_CELL]).map((line, at) =>
    at === 0 ? [...cells.slice(0, COMMENT_CELL), line] : [...Array<string>(COMMENT_CELL).fill(""), line]
  );
}

export const nameRows = (entity: Entity): string[] => labelRowsOf(displayName(entity));

// The row of the rule under the name, counted from the box's top, when the entity has attributes to part.
export const ruleRow = (entity: Entity): number | undefined =>
  entity.attributes.length > 0 ? 1 + nameRows(entity).length : undefined;

// The attribute each row under the divider belongs to, by its index.
export const attributeOwners = (entity: Entity): number[] =>
  entity.attributes.flatMap((attr, at) => attributeRows(attr).map(() => at));

export function attributeColumns(entity: Entity): Array<readonly [number, number]> {
  const rows = entity.attributes.flatMap(attributeRows);
  const columns: Array<readonly [number, number]> = [];
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    const width = widestShown(rows.map((cells) => cells[cell]));
    if (width > 0) columns.push([cell, width]);
  }
  return columns;
}

function formatAttribute(cells: readonly string[], columns: Array<readonly [number, number]>): string {
  const padded = columns.map(([cell, width]) => {
    const text = cells[cell];
    return text + SPACE.repeat(width - shownWidth(text));
  });
  return padded.join(`${SPACE}${TYPE_PIPE}${SPACE}`).replace(TRAILING_BLANKS_RE, "");
}

// Every row of text an entity's box holds, its name first.
export function entityTexts(entity: Entity): string[] {
  const columns = attributeColumns(entity);
  return [...nameRows(entity), ...entity.attributes.flatMap(attributeRows).map((cells) => formatAttribute(cells, columns))];
}
