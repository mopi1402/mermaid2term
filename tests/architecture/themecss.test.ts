import { describe, expect, it } from "vitest";
import { renderThemed } from "../../src/index.js";
import { runOf } from "../support/ansi.js";
import { withConfig } from "../support/frontmatter.js";

const drawn = (css: string, width: number): string =>
  renderThemed(
    withConfig({ themeCSS: `"${css}"` }, "architecture-beta\n  group api(cloud)[API]\n  service db(database)[Database] in api\n  service server(server)[Server] in api\n  service disk[Disk]\n  db:R --> L:server\n  server:B --> T:disk\n"),
    { width, background: "light" },
    "default"
  );

// Measured on mermaid 12.0.0 headless: `.architecture-service` fills a service's name, `.node-bkg` strokes a group's
// frame, `.architecture-groups` fills a group's name, `.edge` strokes an edge and `.arrow` fills its head.
describe("an architecture's own selectors in themeCSS", () => {
  it.each([60, 100])("service and group rules ink the names and the frame (width %i)", (width) => {
    const text = drawn(".architecture-service { fill: #ff0000; } .node-bkg { stroke: #00aa00; } .architecture-groups { fill: #0000ff; }", width);
    expect(runOf(text, "Disk")).toContain("38;2;255;0;0");
    expect(runOf(text, "┏")).toContain("38;2;0;170;0");
    expect(runOf(text, "API")).toContain("38;2;0;0;255");
  });

  it.each([60, 100])("`.edge` inks a line and `.arrow` its head (width %i)", (width) => {
    const text = drawn(".edge { stroke: #aa00aa; } .arrow { fill: #00aaaa; }", width);
    expect(runOf(text, "━━")).toContain("38;2;170;0;170");
    expect(runOf(text, "⏵")).toContain("38;2;0;170;170");
  });

  // Measured on mermaid 12.0.0 headless: a name's inner `tspan` sets its weight and style back to normal, the underline
  // still drawn under it.
  const attributes = (sgr: string): string[] => sgr.replace(/38;2;\d+;\d+;\d+|48;2;\d+;\d+;\d+/gu, "").split(";").filter((part) => part !== "");
  it.each([60, 100])("a font on `.architecture-service` or `.architecture-services` underlines a name and leaves its weight (width %i)", (width) => {
    const plain = attributes(runOf(drawn("", width), "Disk"));
    for (const selector of [".architecture-service", ".architecture-services"]) {
      const said = attributes(runOf(drawn(`${selector} { font-weight: bold; font-style: italic; text-decoration: underline; }`, width), "Disk"));
      expect(said).toEqual([...plain, "4"]);
    }
  });
});
