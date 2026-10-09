import { describe, expect, it } from "vitest";
import { renderThemed, renderThemedText } from "../../src/index.js";
import { SECTION_FOREGROUND_PREFIX, indexed } from "../../src/canvas/keys.js";
import { TWO_PANES } from "../support/drawn.js";
import { withConfig } from "../support/frontmatter.js";

// mermaid 12's journey stylesheet fills a section and its tasks with `fillType<N>` and its actors with the six
// default `actorColours`; its `.actor-N` rules stay empty whatever `actor<N>` says, frontmatter, directive or `base`
// theme alike, and it never reads `cScale` (checked headless on 2026-09-29).
const BODY = "journey\n  section Set up\n    Clone: 4: Dev\n  section Ship\n    Open a PR: 5: Dev, Reviewer";
const headed = (variables: string): string => withConfig(`  themeVariables:\n${variables}`, BODY);
const ownerStyle = (source: string, width: number, owner: string): string =>
  renderThemedText(source, { width, background: "light" }, "default").rows.flat().find((cell) => cell.owner === owner && cell.ch.trim() !== "")?.style ?? "";

describe.each(TWO_PANES)("a journey's own variables, at width %i", (width) => {
  const drawn = (source: string): string => renderThemed(source, { width, background: "light" }, "default");

  it("leaves the cScale bands unread", () => {
    expect(drawn(headed('    cScale0: "#ff0000"\n    cScale1: "#00ff00"\n'))).toBe(drawn(BODY));
  });

  it("paints each section from its fillType", () => {
    const first = ownerStyle(headed('    fillType0: "#ff0000"\n'), width, indexed(SECTION_FOREGROUND_PREFIX, 0));
    expect(first).not.toBe(ownerStyle(BODY, width, indexed(SECTION_FOREGROUND_PREFIX, 0)));
    expect(ownerStyle(headed('    fillType0: "#ff0000"\n'), width, indexed(SECTION_FOREGROUND_PREFIX, 1))).toBe(ownerStyle(BODY, width, indexed(SECTION_FOREGROUND_PREFIX, 1)));
  });

  it("inks an actor in its actorColours seat, whatever actor variable is written", () => {
    expect(ownerStyle(BODY, width, "journey_actor_0")).toBe(ownerStyle(headed('    actor0: "#8FBC8F"\n'), width, "journey_actor_0"));
    expect(ownerStyle(headed('    actor0: "#e8590c"\n'), width, "journey_actor_0")).toBe(ownerStyle(BODY, width, "journey_actor_0"));
    expect(drawn(headed('    actor1: "#e8590c"\n    actor5: "#123456"\n'))).toBe(drawn(BODY));
  });

  // mermaid 12 fills its title `config.journey.titleColor`, the body `title` and the frontmatter one alike; the
  // `actorColours` and `sectionColours` it is handed never reach the drawing (checked headless on 2026-09-29).
  const configured = (keys: string, body: string): string => `---\n${keys}config:\n  journey:\n    titleColor: "#ff00ff"\n    actorColours: ["#ff0000"]\n    sectionColours: ["#0000ff"]\n---\n${body}`;
  const styleOf = (source: string, text: string): string => {
    const rows = renderThemedText(source, { width, background: "light" }, "default").rows;
    const row = rows.find((cells) => cells.map((cell) => cell.ch).join("").includes(text)) ?? [];
    const at = row.map((cell) => cell.ch).join("").indexOf(text);
    return row[at]?.style ?? "";
  };

  it("inks the title in `titleColor`, the body's and the frontmatter's", () => {
    const titled = `journey\n  title Day out\n${BODY.slice("journey\n".length)}`;
    for (const source of [titled, `---\ntitle: Day out\n---\n${BODY}`]) {
      const keys = source.startsWith("---") ? "title: Day out\n" : "";
      const body = source.startsWith("---") ? BODY : titled;
      const plain = styleOf(source, "Day out");
      const inked = styleOf(configured(keys, body), "Day out");
      expect(inked).not.toBe(plain);
      expect(inked.toLowerCase()).toContain("ff00ff");
      expect(styleOf(configured(keys, body), "Clone")).toBe(styleOf(source, "Clone"));
    }
    expect(ownerStyle(configured("", BODY), width, "journey_actor_0")).toBe(ownerStyle(BODY, width, "journey_actor_0"));
  });
});
