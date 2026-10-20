import { must } from "../must.js";
import { CONTROL_RE, NBSP, NEWLINE, SPACE } from "./chars.js";
import { namedCharacters } from "../tables/named-entities.js";

const STYLE_LINE = /(?:style|classDef).*:\S*#/u;

const ESCAPE = /#(\w+);/gu;
const DECIMAL = /^\+?\d+$/u;
const MAX_CODEPOINT = 0x10ffff;

// An escaped character waits as a placeholder from the read to the draw: resolving `#quot;` before the parse hands
// the parser the very character the escape existed to hide.
const HELD_FROM = 0x21;
const HELD_TO = 0x7e;
const HELD_AT = 0xe000;

const drawable = (character: string | undefined): string | undefined =>
  character === undefined || CONTROL_RE.test(character) ? undefined : character;

function resolved(code: string): string | undefined {
  if (DECIMAL.test(code)) {
    const point = Number.parseInt(code, 10);
    return point >= HELD_FROM && point <= MAX_CODEPOINT ? String.fromCodePoint(point) : undefined;
  }
  return namedCharacters().get(code) ?? undefined;
}

function heldOf(character: string): string {
  const point = must(character.codePointAt(0));
  const held = character.length === 1 && point >= HELD_FROM && point <= HELD_TO;
  return held ? String.fromCharCode(HELD_AT + point) : character;
}

export function decodeEntities(text: string): string {
  if (!text.includes("#")) return text;
  return text
    .split(NEWLINE)
    .map((line) =>
      STYLE_LINE.test(line)
        ? line
        : line.replace(ESCAPE, (whole, code: string) => {
            const character = drawable(resolved(code));
            return character === undefined ? whole : heldOf(character);
          })
    )
    .join(NEWLINE);
}

export function drawnChar(ch: string): string {
  if (ch.length !== 1) return ch;
  const point = ch.charCodeAt(0);
  return point >= HELD_AT + HELD_FROM && point <= HELD_AT + HELD_TO ? String.fromCharCode(point - HELD_AT) : ch;
}

// An HTML character reference, `&amp;` `&#60;` `&#x3c;`, resolved as the browser resolves it in mermaid's html
// labels, and held like an escape: `&lt;b&gt;` draws `<b>`, never a bold tag.
const HTML_REFERENCE = /&(?:#x([\da-f]+)|#(\d+)|([a-z][a-z\d]*));/giu;

function referenced(hex: string | undefined, decimal: string | undefined, name: string | undefined): string | undefined {
  if (name !== undefined) {
    const named = namedCharacters().get(name) ?? undefined;
    return named === NBSP ? SPACE : named;
  }
  const point = hex === undefined ? Number.parseInt(decimal ?? "", 10) : Number.parseInt(hex, 16);
  return point > 0 && point <= MAX_CODEPOINT ? String.fromCodePoint(point) : undefined;
}

export const htmlDecoded = (text: string): string =>
  text.includes("&")
    ? text.replace(HTML_REFERENCE, (whole, hex?: string, decimal?: string, name?: string) => {
        const character = drawable(referenced(hex, decimal, name));
        return character === undefined ? whole : heldOf(character);
      })
    : text;
