# Divergences from mermaid, decided

mermaid2term follows mermaid's grammar and rendering unless a row below says otherwise. Anything else that differs is a gap or a bug, not a choice. Every row is frozen by a test or a corpus drawing.

## Every kind

| Divergence | Why |
| --- | --- |
| A source mermaid throws on is still drawn: a slip whose intent reads takes its nearest valid form (`A -- B` as `A --- B`), anything else the neutral form of its kind (an unknown shape is a rectangle) | Sources are often generated; one wrong token should cost one node, not the whole drawing |
| `graph`, `flowchart`, `stateDiagram`, `erDiagram` and `classDiagram` default to `LR`, not `TB` | A terminal is wide and short |
| Two independent lines that cross are cut, the one running on keeps the cell; true junctions keep `┼` | On a grid `┼` reads as lines meeting |
| A title wider than its drawing widens it, folded on words only past the width budget | mermaid's SVG cuts it at the boxes; a terminal must not drop words it has room for |
| A theme drawn for the other ground switches to its twin (`default` and `dark`…), or is mirrored into a softer palette | mermaid knows nothing of the terminal's ground |
| A theme variable the source writes is honoured where mermaid's sanitizer drops it (`stateBorder`, `nodeTextColor`…) | mermaid's own stylesheets read them |
| A class's `classDef` and a `background-color` are drawn | mermaid shows nothing, though the source said what it wanted |
| The sixteen terminal colour names (`red`, `bright_blue`…) are the terminal's own colours | `red` means the red of the reader's terminal |
| `rgba()` is laid over black, `#rrggbbaa` loses its alpha | A cell holds one ground, with no layer to blend |
| Our own keys, prefixed `m2t_`: `charset`, `borders`, `bands`, `airyLabels`, `snugFrames`, `autoRotate`, `faintColor`, `edgeLabelColor` | Terminal concerns mermaid has no key for |
| Pixel keys read as cells, in proportion to mermaid's default: `flowchart.padding`, `block.padding`, `nodeSpacing` and `rankSpacing` under `layout: dagre` | A terminal has no pixels |

## By kind

| Kind | Divergence | Why |
| --- | --- | --- |
| flowchart | A subgraph's `direction` is honoured even when linked from outside | mermaid's limit is its layout engine's; mixing directions keeps the drawing compact |
| flowchart | mermaid 11 and 12's `@{ shape: }` names are drawn as a known outline plus one sign per family (a waved foot, a folder tab, a `△` mark) | A grid cannot trace their SVG outlines |
| flowchart | A FontAwesome icon (`fa:fa-car`) in a label is drawn as nothing | What mermaid shows without the stylesheet |
| flowchart | Under `neo`, a brace is stroked whole in `gradientStart` | Two braces in two colours read as two signs |
| sequence | Participants are not repeated at the foot, unless a height budget is missed | Height is what a terminal lacks |
| sequence | `par_over` stacks its sections | Overlapping messages erase each other on a grid |
| sequence | An entity code (`#9829;`) survives in a label | mermaid's lexer eats it at the `#` |
| sequence | A block's frame is faded over the page | A dotted rule at full strength reads louder than an SVG stroke |
| sequence | A note with no rim of its own is ruled a shade under its slab | It keeps its edge on a ground close to its own |
| class | A `%%` comment is cut everywhere, after a `:` or inside braces too | mermaid's lexer stops seeing it there |
| class | A `\n` in a note breaks the line | As mermaid's own documentation means it |
| state | A dashed composite keeps its double floor solid | No glyph is both doubled and dashed |
| state | A markdown string in a description is read | It is mermaid's markdown spelling everywhere else |
| mindmap | A cross round the root, in straight lines | A terminal has four angles only |
| mindmap | Past eleven branches, a colour comes back across the root, not beside it | Two neighbours in one colour merge |
| mindmap | Too wide for its budget, drawn as an indented tree | It fits any width and keeps every node |
| mindmap | A spine several branches share keeps `lineColor` | A cell holds one ink |
| mindmap | Every node is a chip, whatever shape it writes; `mindmap.padding` is unread | An outline costs two rows and two columns a node |
| mindmap | An icon is a glyph the charset knows, or nothing | A terminal has no icon font |
| timeline | With no direction, turns down once even its tightest fold is too wide | Folding keeps mermaid's form as long as it can |
| gitgraph | In `TB` and `BT`, a tag stands left of its commit | A terminal cannot turn text, and the right is where merges arrive |
| gitgraph | An unnamed commit shows its place in the source, not a random id | A random id changes the drawing on every render |
| gitgraph | A cherry-pick's disc turns white on a dark page | A black disc does not show there |
| gitgraph | A branch's bare line is drawn at a quarter of its ink | Dashes take a full cell and would read as loud as the commits |
| gantt | Under `compact`, a milestone's name hangs under the dates, in its own amber | Beside its mark it reads as one more bar's label |
| gantt | Two bars of one ink on touching rows are parted by an eighth of a cell | Otherwise two tasks read as one |
| gantt | The axis also names the chart's first and last date | A narrow chart is often left with one round date |
| gantt | An `excludes` date matches whatever the case of its month | mermaid silently drops it on a case slip |
| gantt | `0.5d` keeps its fraction | It is the same half day as `12h` |
| xychart | `showDataLabel` writes each bar's own value | mermaid writes the first plot's values on every series |
| xychart | A partial `themeVariables.xyChart` keeps the theme's other inks | mermaid falls back to `default`'s, unreadable on a dark page |
| kanban | A card's priority is its left wall, heavy and coloured | A cell cannot hold a 4px bar beside a border |
| architecture | A junction whose branches pair up is folded away, unless a head points into it | A straight run reads plainer than a join |
| architecture | A service seated inside a group it is not a member of steps out | A frame reads as membership |
| block | An arrow block is a box with a tip on each wall it points through | Slanted walls break into steps |
| block | A block of width `0` takes one column | mermaid draws nothing at all |
| block | A labelled link moves its blocks apart to hold the label whole | mermaid lays the blocks out ignoring it, the label's box lands over them |
| packet | Too wide for its budget, the row halves its bits | A terminal cannot scale the strip |
| journey | The faces stand on a ruled 5 to 1 scale | A bare row says nothing of the score |
| quadrant | Texts that meet are moved apart | On a grid the later text erases the earlier |
