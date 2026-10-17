import { BY_NAME } from "@/corpus";
import { read, type Address } from "@/address";

export const INITIAL_SOURCE = [
  "graph TD",
  '    A["Start"] --> B{"Decision"}',
  '    B -->|"Yes"| C["Process"]',
  '    B -->|"No"| D["End"]',
  "    C --> D",
  "",
].join("\n");

// No fragment at all is the page as it opens bare, so going back to it brings the opening source back.
export const addressAt = async (fragment: string): Promise<Address> => {
  if (fragment === "") return { name: undefined, source: INITIAL_SOURCE };
  const { name, source } = await read(fragment);
  return { name, source: source ?? (name === undefined ? undefined : BY_NAME.get(name)?.source) };
};

export const addressAtOpening = (): Promise<Address> => addressAt(location.hash.slice(1));

export const setAddress = (fragment: string, push: boolean) => {
  if (location.hash.slice(1) === fragment) return;
  if (push) location.hash = fragment;
  else history.replaceState(null, "", `#${fragment}`); // boundary: the History API's "no state"
};
