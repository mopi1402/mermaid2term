const TILDE = "~";
const COMMA = ",";

const tildes = (text: string): number => [...text].filter((ch) => ch === TILDE).length;

// mermaid's `processSet`: tildes paired from the outside in, a leading one set aside when the count is odd.
function bracketed(set: string): string {
  if (tildes(set) <= 1) return set;
  const leading = tildes(set) % 2 !== 0 && set.startsWith(TILDE);
  const chars = [...(leading ? set.slice(1) : set)];
  let first = chars.indexOf(TILDE);
  let last = chars.lastIndexOf(TILDE);
  while (first !== -1 && first !== last) {
    chars[first] = "<";
    chars[last] = ">";
    first = chars.indexOf(TILDE);
    last = chars.lastIndexOf(TILDE);
  }
  return `${leading ? TILDE : ""}${chars.join("")}`;
}

// mermaid writes a generic between tildes and draws it between angle brackets, the same `parseGenericTypes` for a
// class member and for an entity's attribute (`erBox.ts` runs it over every cell it writes). A comma splits the
// text first, and the two sides of one are joined again when each holds a single tilde, so `Map~K,V~` is `Map<K,V>`.
export function generics(text: string): string {
  const sets = text.split(/(,)/u);
  const out: string[] = [];
  for (let at = 0; at < sets.length; at++) {
    let set = sets[at];
    if (set === COMMA && at > 0 && at + 1 < sets.length && tildes(sets[at - 1]) === 1 && tildes(sets[at + 1]) === 1) {
      set = `${sets[at - 1]}${COMMA}${sets[at + 1]}`;
      at++;
      out.pop();
    }
    out.push(bracketed(set));
  }
  return out.join("");
}
