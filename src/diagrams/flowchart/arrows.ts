import { maskQuotes, stripQuotes } from "../../source/quotes.js";
import { unIconed } from "../../text/labels.js";
import { ArrowType, EdgeStyle } from "../../graph/model.js";
import { makeSegment, type ArrowMatch, type Segment } from "./segments.js";
import {
  EDGE_ID_TAIL_RE,
  ENDS_MARKED,
  MIN_LENGTH,
  OPEN_RUN,
  PIPED_ARROW,
  PLAIN_ARROWS,
  SHORT_RUN,
  SPLIT_ARROWS,
  classifyArrow,
  START_MARKED,
  computeArrowLength,
} from "./patterns.js";

const PIPE = "|";

export function splitByArrows(line: string): Segment[] {
  const segments: Segment[] = [];
  let remaining = line.trim();

  while (remaining !== "") {
    // A shape's text is no link: `A[a -- b] --> B` links A to B.
    const masked = maskQuotes(remaining, true);
    let best: ArrowMatch | undefined;

    const labelled = findLabelledArrow(masked, remaining);
    if (labelled !== undefined) {
      const span = remaining.slice(labelled.pos, labelled.end);
      const pipeStart = span.indexOf(PIPE);
      const pipeEnd = span.lastIndexOf(PIPE);
      const label =
        pipeStart >= 0 && pipeEnd > pipeStart ? stripQuotes(span.slice(pipeStart + 1, pipeEnd).trim()) : labelled.label;
      best = { ...labelled, label };
    }

    const plain = findPlainArrow(masked);
    if (plain !== undefined && (best === undefined || plain.pos < best.pos)) best = plain;

    if (best === undefined) {
      const text = remaining.trim();
      if (text !== "") segments.push(makeSegment({ text }));
      break;
    }

    let before = remaining.slice(0, best.pos).trim();
    let edgeId = "";
    const named = before.replace(EDGE_ID_TAIL_RE, "");
    if (named !== "") {
      edgeId = before.slice(named.length).trim().slice(0, -1);
      before = named;
    }
    if (before !== "") segments.push(makeSegment({ text: before }));

    segments.push(
      makeSegment({
        text: remaining.slice(best.pos, best.end),
        isArrow: true,
        edgeId,
        edgeStyle: best.style,
        hasArrowStart: best.hasStart,
        hasArrowEnd: best.hasEnd,
        arrowTypeStart: best.typeStart,
        arrowTypeEnd: best.typeEnd,
        label: unIconed(best.label),
        minLength: best.length,
      })
    );

    remaining = remaining.slice(best.end).trim();
  }

  return segments.length > 0 ? segments : [makeSegment({ text: line.trim() })];
}

function findLabelledArrow(text: string, written: string): ArrowMatch | undefined {
  const piped = PIPED_ARROW.exec(text) ?? undefined;
  if (piped !== undefined) {
    const whole = piped[0];
    const arrowPart = text.slice(piped.index, piped.index + whole.indexOf(PIPE));
    const bare = arrowPart.trim();
    const marked = ENDS_MARKED.test(bare) || OPEN_RUN.test(bare) || START_MARKED.test(bare);
    const spelled = marked ? arrowPart : `${arrowPart}>`;
    const { style, hasStart, hasEnd, typeStart, typeEnd } = classifyArrow(spelled);
    return {
      pos: piped.index,
      end: piped.index + whole.length,
      style,
      hasStart,
      hasEnd,
      label: piped[5].trim(),
      length: computeArrowLength(arrowPart, style),
      typeStart,
      typeEnd,
    };
  }

  for (const re of SPLIT_ARROWS) {
    const m = re.exec(text) ?? undefined;
    if (m === undefined) continue;
    const halves = m[1] + m[3];
    const labelAt = m.index + m[1].length;
    const { style, hasStart, hasEnd, typeStart, typeEnd } = classifyArrow(halves);
    return {
      pos: m.index,
      end: m.index + m[0].length,
      style,
      hasStart,
      hasEnd,
      label: stripQuotes(written.slice(labelAt, labelAt + m[2].length).trim()),
      // Off the SECOND half alone, mermaid's rule: `-- text ---` is a link of one, exactly as `---` is.
      length: computeArrowLength(m[3], style),
      typeStart,
      typeEnd,
    };
  }
  return undefined;
}

function findPlainArrow(text: string): ArrowMatch | undefined {
  let best: ArrowMatch | undefined;
  for (const { re, style, hasStart, hasEnd, typeStart, typeEnd } of PLAIN_ARROWS) {
    const m = re.exec(text) ?? undefined;
    if (m === undefined || (best !== undefined && m.index >= best.pos)) continue;
    best = {
      pos: m.index,
      end: m.index + m[0].length,
      style,
      hasStart,
      hasEnd,
      label: "",
      length: MIN_LENGTH,
      typeStart,
      typeEnd,
    };
  }
  const short = SHORT_RUN.exec(text) ?? undefined;
  if (short !== undefined && (best === undefined || short.index < best.pos)) {
    const run = short[0];
    const style = run.includes(".") ? EdgeStyle.DOTTED : run.includes("=") ? EdgeStyle.THICK : EdgeStyle.SOLID;
    best = { pos: short.index, end: short.index + run.length, style, hasStart: false, hasEnd: false, label: "", length: MIN_LENGTH, typeStart: ArrowType.ARROW, typeEnd: ArrowType.ARROW };
  }
  if (best === undefined) return undefined;
  return { ...best, length: computeArrowLength(text.slice(best.pos, best.end), best.style) };
}
