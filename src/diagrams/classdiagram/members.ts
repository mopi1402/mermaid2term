import {
  type Marker,
  type ClassDef,
  type Member,
} from "./model.js";
import { type CharSet } from "../../canvas/model.js";
import { type Toward } from "../../canvas/corners.js";
import { arrowToward } from "../../graph/render/glyphs.js";

const ANNOTATION_OPEN = "«";

const ANNOTATION_CLOSE = "»";

// The way a marker faces is the way a tee's stub faces, and one naming serves both.
export type Heading = Toward;

export function markerChar(cs: CharSet, marker: Marker | undefined, heading: Heading): string {
  if (marker === "|>" || marker === "<|") return cs.inheritance[heading];
  if (marker === ">" || marker === "<") return arrowToward(cs, heading);
  if (marker === "*") return cs.composition;
  if (marker === "o") return cs.aggregation;
  return "";
}


export function formatMember(member: Member): string {
  let text = "";
  if (member.visibility !== undefined) text += member.visibility;
  if (member.returnType !== "" && !member.isMethod) text += `${member.returnType} `;
  text += member.name;
  if (member.isMethod && member.returnType !== "") text += ` : ${member.returnType}`;
  return text;
}

export const annotationText = (cls: ClassDef): string => `${ANNOTATION_OPEN}${cls.annotation}${ANNOTATION_CLOSE}`;

export const partitioned = (cls: ClassDef): [Member[], Member[]] => [
  cls.members.filter((member) => !member.isMethod),
  cls.members.filter((member) => member.isMethod),
];
