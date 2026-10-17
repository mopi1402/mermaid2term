export const GRAPH_NOTES: Record<string, string[]> = {
  "flowchart/frontmatter": [
    "A frontmatter carries more than a title: `config.theme` picks the palette, and `themeVariables` overwrites the inks read off it.",
    "`mainBkg` fills the nodes, `nodeBorder` walls them, `lineColor` draws the edges, `textColor` the labels. A theme named here wins over the one the picker asks for.",
  ],
  "sequence/frontmatter": [
    "`config.sequence` is mermaid's own block for this kind: `showSequenceNumbers` numbers every message, `mirrorActors` brings the heads back at the foot.",
    "Beside it the inks: `actorBkg` and `actorBorder` dress the participants, `signalColor` and `signalTextColor` the arrows and their words.",
  ],
  "class/frontmatter": [
    "Two blocks under one `config:`. `class.hideEmptyMembersBox` collapses Money and Currency to a name alone, where Invoice keeps its two compartments.",
    "`themeVariables` does the colour beside it: `mainBkg` and `nodeBorder` on the boxes, `edgeLabelBackground` behind `amounts in`.",
  ],
  "state/frontmatter": [
    "A state machine dressed from its frontmatter: `mainBkg` and `nodeBorder` on the states, `lineColor` on the transitions.",
    "`transitionLabelColor` inks `confirm` and `dispatch` alone, which no other variable reaches.",
  ],
  "er/frontmatter": [
    "`config.er.layoutDirection` lays the schema out, and it counts as declared: the fitting no longer turns it when the terminal gets narrow.",
    "`nodeBorder` walls the entities, `lineColor` draws the relationships and their crow's feet, `nodeTextColor` writes the names and the relationships' labels.",
  ],
  "gantt/frontmatter": [
    "`config.gantt` carries the axis: `axisFormat` spells the dates, `tickInterval` rules one mark every twelve hours. Both are statements too, and a statement in the body wins over the config.",
    "`doneTaskBkgColor` greys the frozen branch, `activeTaskBkgColor` lights the tag, `gridColor` rules behind them, `cScale0` and `cScale1` band Cut and Ship.",
  ],
  "pie/frontmatter": [
    "A pie reads the node inks and nothing of mermaid's `pie1` to `pie12`: `nodeBorder` walls the slices, `lineColor` rules them, `textColor` writes the legend.",
    "Slices differ by shade glyph here, never by colour, so one border ink dresses the whole chart.",
  ],
  "journey/frontmatter": [
    "The section bands are theme variables, not journey ones: `cScale0` and `cScale1` colour Set up and Ship.",
    "A band nobody writes keeps the colour `redux-color` gives it, exactly as mermaid states each `cScale` under its own name.",
  ],
  "gitgraph/frontmatter": [
    "`config.gitGraph.mainBranchName` names the trunk, which a gitGraph has no statement for: the body checks out `release` because the config said so.",
    "`nodeBorder` rings the commits, `lineColor` draws the branch lines, `clusterBorder` the names down the side.",
  ],
  "mindmap/frontmatter": [
    "A mindmap reads few variables, and this shows the two it has: `nodeBorder` on every branch, `textColor` on every word.",
    "There is no fill to set: the tree is drawn with lines, so `mainBkg` says nothing here.",
  ],
  "timeline/frontmatter": [
    "`m2t_charset: compat` is read off the frontmatter too, and swaps the glyphs a narrow font may not carry.",
    "A redux theme reads no `cScale`: `nodeBorder` writes every name, event and line, `textColor` the title and the arrowhead, each section keeping the `borderColorArray` seat `redux-color` gives it.",
  ],
  "quadrant/frontmatter": [
    "The four quadrants take the section bands `cScale0` to `cScale3`, mermaid's `quadrant1Fill` and its siblings being ignored here.",
    "`faintColor` rules the axes behind them, which is what keeps the grid off the points.",
  ],
  "xychart/frontmatter": [
    "`config.xyChart.chartOrientation` turns the chart on its side, which `xychart-beta horizontal` says in the header instead.",
    "`cScale0` paints the bars and `cScaleLabel0` the figures over them, `lineColor` the axes, `m2t_edgeLabelColor` the ticks.",
  ],
  "kanban/frontmatter": [
    "One band per column, and one label ink per band: `cScale0` to `cScale2` fill Todo, In Progress and Done, `cScaleLabel0` to `cScaleLabel2` name them.",
    "The cards take a deeper shade of their column's band, so three lines dress the whole board.",
  ],
  "block/frontmatter": [
    "`theme: base` is the one mermaid means to be overwritten, and `primaryColor` cascades from it: the block walls derive from it without naming `nodeBorder`.",
    "Under a named theme that cascade is masked, the theme stating its own border, and the leaf variable has to be written instead.",
  ],
  "packet/frontmatter": [
    "A packet is drawn from three inks: `nodeBorder` for the frame, `textColor` for the field names, `m2t_edgeLabelColor` for the bit numbers.",
    "The bit ranges themselves are untouched by any of it.",
  ],
  "treemap/frontmatter": [
    "`cScale0` fills Repo, the first section, and its leaves over it, which walls them in it whole.",
    "`cScaleLabel0` writes Repo's name, `cScaleLabel1` TypeScript's name and value: mermaid seats the texts by name, sections first.",
  ],
  "architecture/frontmatter": [
    "A group has a fill of its own: `clusterBkg` and `clusterBorder` dress Edge, `mainBkg` the services inside it.",
    "`lineColor` draws the link between them, and the title sits outside the outermost group.",
  ],
  "flowchart/node-shapes": [
    "Twenty-five shapes chained, every bracket form mermaid spells and the `@{ shape: }` names drawn beside them.",
    "Each keeps its own silhouette in plain Unicode, and the text block has no outline at all.",
  ],
  "flowchart/labels": [
    "Everything mermaid lets a label carry, one node per form: a <br> break, a markdown string, the <b> and <i> tags, entity codes, then emoji and CJK.",
    "Width is measured in COLUMNS and not in characters, so a wide glyph takes the two cells it really occupies and the box closes on it.",
    "Weighed and Slanted carry no markup at all: their face comes from font-weight and font-style on a classDef.",
  ],
  "flowchart/links": [
    "click A \"url\" hangs a URL on a node, in the href form as well, and mailto: counts.",
    "The label carries it through OSC 8: underlined here, and the terminal decides whether it opens.",
    "Only http, https and mailto are kept; any other scheme leaves the label and drops the link.",
  ],
  "flowchart/edge-styles": [
    "Three stroke styles, each with a meaning: solid call, dotted async, thick critical path.",
    "Edge labels ride their line without breaking it.",
  ],
  "flowchart/right-to-left": [
    "The same flow drawn right to left with flowchart RL.",
    "Geometry mirrors and arrowheads flip, labels stay readable.",
    "A named direction is obeyed: auto-rotate never overrides it.",
  ],
  "flowchart/top-to-bottom": [
    "A decision splits the flow and both branches reach End.",
    "flowchart TD forces the vertical reading.",
    "A named direction is obeyed: auto-rotate never overrides it.",
  ],
  "flowchart/colour-styles": [
    "One style case per node: Gate shows the bare theme, a fill alone drops the border (Build, Announce), Release pairs fill and stroke, Rollback contrasts them.",
    "Borders are drawn: stroke-dasharray dashes Archive, stroke-width 3px and up makes Alert heavy, colour or not.",
    "Declared three ways: classDef, style on one node, linkStyle on ok and ko.",
  ],
  "flowchart/ci-cd-pipeline": [
    "A three-gate pipeline: Pass?, Approve?, Healthy?.",
    "The three No's converge on one Notify without ever merging lines.",
    "linkStyle paints Yes green and No red.",
  ],
  "flowchart/hub": [
    "Four log producers converge on one hub, each arrival with its own head, no crossing.",
    "Stroke and colour mean something: jobs dotted, slow queries thick orange, critical thick red, the rest green.",
  ],
  "flowchart/subgraphs": [
    "Client, server and data tiers as subgraphs.",
    "A load balancer fans out to two app servers sharing PostgreSQL and Redis.",
  ],
  "flowchart/service-tiers": [
    "Web and Mobile cross into the backend tier to reach the BFF.",
    "An API gateway fans out to three services, each with its own store.",
    "Cylinders for the databases, and the queue is one lying on its side.",
  ],
  "flowchart/order-fulfilment": [
    "An order from placement to delivery in thirteen shapes: circle and double circle for the ends, stadium for the cancellation, rhombus for the two gates, subroutine for the card charge, hexagon for the bank, divided and lined process for picking and retrying, a flag for the backorder.",
    "The stroke says the weight: thick for the happy path once paid, plain for the checks, dotted for what happens later (a restock, a third failed attempt) and for the two asides.",
    "Edges run every way: down the main flow, back up from Retry to Charge card and from Backorder to the cart, both ways at once for the 3-D Secure exchange.",
    "A comment brace on the bank marks the PCI scope, a two-sided brace on shipping carries the cutoff.",
  ],
  "flowchart/traffic-lights": [
    "A CI loop with colour as the signal: pass green, fail red, flaky orange.",
    "Emoji mark the stations and the retry loops back to the tests.",
  ],

  "sequence/arrow-types": [
    "Every arrow a sequence spells, in four runs: dotted, solid, the half-arrows and the connection dots.",
    "Doubling the dash run is what makes an arrow dotted: -->> is ->> dashed, --// is -// dashed.",
    "A crossed head reads as a message lost or refused; an open one as a call that does not wait.",
    "A half-arrow says the head keeps one half of itself, and a leading slash hangs that head off the SENDER instead: the message still runs Left to Right, only the end wearing the head moves.",
    "The barb is drawn on the side the spelling names: a filled one as a box-drawing tee whose heavy arm is the barb, a stick one as a hairline bracket set high or low in the cell. Both stand ONE CELL IN, so the lifeline they point at stays whole underneath.",
    "A () glued to a participant marks that end with a connection dot, which lands ON the lifeline: the arrow gives up its outermost cell to it, so the end still reaches the participant, through the dot rather than through its own head.",
  ],
  "sequence/activations": [
    "A call left waiting while three more pile on top of it, then answered one by one in the order they arrived.",
    "The band is the stretch of time a participant is busy: it opens on the arrow that arrives and closes on the line that leaves, and a message meeting it in between hangs its arm on it.",
    "Written two ways in the same source, and they mean the same thing: activate/deactivate on their own lines, or a + and a - hung on the message lines themselves.",
    "There is one column, so there is one box: a call started while another runs does not get a band of its own. The count beside the band says how many are stacked, +3 at the deepest.",
  ],
  "sequence/basic-messages": [
    "A classic request chain: client, server, database and back.",
    "Solid arrows for calls, dashed for replies.",
  ],
  "sequence/participant-types": [
    "Four participant kinds, each with its own silhouette: a stick-figure actor, a plain box, two cylinders tagged queue and db, names beneath the symbols.",
    "The kind says what listens: a human, a service, a buffer, a store.",
    "Spelt mermaid's way: participant X@{ type: queue }; the bare keywords work too.",
  ],
  "sequence/notes": [
    "A note pinned right of one participant, another spanning two.",
    "The lifelines keep their spacing around them.",
  ],
  "sequence/control-flow": [
    "loop, alt/else and opt, one nested inside another: the three blocks mermaid brackets a run of messages with.",
    "Each frame is named by a cartouche on its own rule, the keyword left of the bar and the author's condition right of it.",
    "The frame is dashed and half-toned, so it sits behind the messages; where a lifeline crosses it, the crossing keeps the lifeline's colour.",
  ],
  "sequence/parallel-and-break": [
    "The three blocks control-flow leaves out: par with its and, critical with its options, and break.",
    "par says the branches happen together; a character cell holds one glyph, so they are stacked one under the other and the tab keeps saying par.",
    "critical is the run that must succeed, and each option is a way it can fail: they are sections of one frame, like an else, not frames of their own.",
    "break leaves the flow for good, so its frame holds the last thing that happens; it is bracketed like any other block, the keyword left of the bar and the author's reason right of it.",
    "A frame is only as wide as the participants inside it: critical spans two columns here, break spans four.",
  ],
  "sequence/destroy": [
    "destroy ends a participant mid-flow: its foot box lands on the last message it touches.",
    "The dead lifeline stops there, the living ones keep running below.",
  ],
  "sequence/create-and-destroy": [
    "Both ends of ONE lifeline, which go together: the session is opened by the login and taken away by the logout, and the client and the gatekeeper outlive it.",
    "A created participant is drawn on the row that creates it, not in the header: the arrow meets its box and the lifeline drops from under it.",
    "destroy is the same read backwards, its foot box landing on the last message the participant touches.",
  ],
  "sequence/participant-boxes": [
    "box groups participants that belong together, and the group holds for the length of the exchange, not just where they are named.",
    "The frame is the DOUBLE rule: what it holds already wears a single one each, and a frame of the same weight would read as one more box.",
    "A message leaving the group crosses a wall, and the crossing is drawn as one, so the wall stays unbroken.",
    "box rgb(91,84,140) Business names its own fill, and every ink inside is weighed against it: the note's rule comes out one colour over the page, another over the teal.",
    "rect rgb(191, 223, 255) is the one block that IS a colour: no rule, no name, just a slab, and mermaid draws it with no border either.",
    "The slab is laid OVER the groups, so it takes their colour for the rows it covers: mermaid lowers a box under the rects for the same reason, the reply crossing between the two groups belonging to neither.",
  ],
  "sequence/autonumber": [
    "autonumber counts every message, and the count is a MEDALLION on the cell the arrow leaves from: mermaid draws a disc on the sender's lifeline, and the label never carries it.",
    "The disc sits at the end WITHOUT the head, so a reply from John wears it on John's side, and a self-message where its loop sets off.",
    "One to twenty have a glyph each; past twenty the number is spelt one disc per digit, eaten off the shaft so it never leaves the arrow.",
  ],
  "class/links": [
    "mermaid's `link Shape \"url\"` and `click Shape2 href \"url\"`: the class NAME carries the URL through OSC 8, the terminal's own hyperlink, and the rest of the box stays plain.",
    "The tooltip is dropped, there being no pointer to hover it; `click ... call f()` and `callback` are skipped, a drawing runs nobody's code.",
    "Only http, https and mailto pass, as everywhere a URL is hung on a drawing.",
  ],
  "class/styles": [
    "Four columns. None: `stroke-width:0` draws no border at all, the fill alone saying where the box is.",
    "Thin and Heavy: the five levels of `stroke-dasharray`, its first number, in the light glyphs at 1px and the heavy ones from 2px. Each `style` opens on a `stroke:` colour because mermaid's own class grammar refuses a `-` in the first property, where this parser reads it fine. 1 the finest, 2 the triple, 3 the double, 4 a half line, 5 and more a dash every other cell; the wall one step denser than the lid.",
    "Colors, one property at a time in one family of blues: a `fill` is a ground under the whole inside, a `stroke` the ink of the ring and the dividers, a `color` the ink of the words, laid as the author wrote it. Pale turns the pair over, sky on navy; All wears the three, its navy ring heavy.",
  ],
  "class/cardinality": [
    "mermaid's cardinalities, read in LR: a cardinality sits over the run against its marker, on the far side from the box, never on the stroke.",
    "A fan out of Student runs as far as its widest cardinality before it turns, one trunk for both edges, each 1..n over its own exit.",
    "A labelled edge carries its chip on the far run and the target's cardinality beside the arrowhead (many).",
    "A cardinality is any quoted text: mermaid's 0..1, 1..*, 1..n, or a word of your own, like custom.",
  ],
  "class/lollipop": [
    "mermaid's lollipop interfaces: a name and a ring, never a box. Ordering ()-- puts the ring at the head of the run, --() Billing at its foot.",
    "One declaration is one interface, so the two --() Billing lines draw two rings: mermaid means an interface OFFERED by that class, not a shared node.",
    "The association below is drawn beside them to tell the two apart: a class keeps its walls and its compartments, an interface never gets any.",
  ],
  "class/namespaces": [
    "mermaid's nested namespaces: Company.Engineering.Backend is Backend inside Engineering inside Company, each a frame labelled with its segment.",
    "A namespace is laid out on its own and set as one block in its parent's layout; an edge into a frame crosses its lid, its chip on the shaft.",
    "A ['label'] on a namespace names the last frame.",
  ],
  "class/animal-example": [
    "mermaid's own Animal example, with a frontmatter title: the title is drawn centred over the diagram, as mermaid does for any diagram type.",
    "A note for Duck reads its <br> tags as breaks, one row each, and hangs from Duck by a dotted tether.",
    "The floating note keeps its row above the classes; a note FOR a class stands beside it, the tether saying which.",
  ],
  "sequence/links": [
    "link Alice: Dashboard @ https://... hangs a link on a participant; mermaid folds them into a menu that opens on a click.",
    "A terminal has no click, so the menu is drawn OPEN inside the box: the name, a rule, then a row per link.",
    "Each name carries its URL through OSC 8, the way a flowchart's click does: underlined here, and the terminal decides whether it opens.",
    "The JSON form links Alice: {\"Dashboard\": \"https://...\"} reads the same, and a scheme a terminal may not open (javascript:, file:) keeps the name and drops the link.",
  ],
  "sequence/oauth-2-0-flow": [
    "The full OAuth 2.0 authorization-code dance across four participants.",
    "Ten messages, calls and replies interleaved.",
  ],
  "sequence/fraud-review": [
    "Six participants, from the analyst down to the ledger store.",
    "Queueing, scoring and persistence in one exchange.",
    "Messages too long for the width fold onto two lines: autoWrap, on by default.",
  ],

  "class/relationship-types": [
    "mermaid's eight relationship types: inheritance, composition, aggregation, association, solid link, dependency, realization, dashed link.",
    "The marker sits at the end the source points it at; a dotted shaft says dependency, realization or a dashed link.",
    "Each edge is labelled with its own name.",
  ],
  "class/annotations": [
    "mermaid's stereotypes, drawn in guillemets over the name: the three ways of declaring one, inside the body for Shape and Colour, after the name for Figure, on a line of its own for Renderer.",
    "An enumeration's constants are members with no type and no parentheses, so they band with the attributes and leave the method compartment blank.",
  ],
  "class/members": [
    "The four visibilities, written as the sign mermaid writes: + public, - private, # protected, ~ package.",
    "A trailing * is the abstract classifier and a trailing $ the static one, and a terminal has the two inks for them: flush() in italics, instances and open() underlined.",
    "A generic ~T~ is drawn <T> wherever it stands, on the class name, on a return type, inside a parameter list; a return type is set off by a colon, as mermaid sets it off.",
  ],
  "class/basic-class": [
    "A base class with fields and methods, two subclasses inheriting it.",
    "Members keep their visibility marks.",
    "A class with any member shows both compartments, an empty one staying as a blank band: second band attributes, third band methods, always.",
  ],
  "class/mvc-pattern": [
    "Model, View and Controller with their real dependencies.",
    "Private and public members are told apart.",
  ],
  "class/change-request": [
    "A change-request domain in five classes.",
    "Typed fields, methods, and labelled associations from checks down to audit.",
  ],

  "er/basic-relationships": [
    "Customers, orders, line items and products.",
    "Crow's-foot cardinalities on every relationship.",
    "No direction declared, so it lies flat: a terminal is wide before it is tall.",
  ],
  "er/all-cardinality-types": [
    "The four cardinality pairs, one per row.",
    "One-to-one, one-to-many, many-to-many, zero-or-one.",
    "Each pair is written in line: label over the shaft, cards under its ends, tees welded into the frames.",
  ],
  "er/e-commerce-schema": [
    "A shop's schema: users, orders, items, products, reviews.",
    "Five relationships, each labelled with its verb.",
    "One cycle, cut into a line: the closing relationship rides around, and a tight budget folds the line like text.",
  ],
  "er/subgraphs": [
    "Mermaid's own nested subgraph example: three framed panels, title3 living inside title2.",
    "Each panel is laid out on its own and seated in its parent as one block, its title centred on the frame.",
    "CAR reaches NAMED-DRIVER straight across: a panel no relationship touches is parked apart, never in the pair's way.",
    "A frame wears what a box wears: style title3 dashes the panel buried inside it, mermaid looking an id up among the subgraphs as well as the entities.",
  ],
  "er/cardinality-in-words": [
    "Every cardinality mermaid also spells in words: only one, zero or more, many(1), 0+, and 1 alone, matched whatever the case (ONE TO ZERO OR ONE).",
    "The relation type rides the same words: to draws the solid identifying line, optionally to the dotted one.",
  ],
  "er/relationship-lines": [
    "-- is identifying and drawn solid, .. is non-identifying and drawn dotted, and .- or -. read as .. does.",
    "EMPLOYEE manages EMPLOYEE: a relation on itself loops out of the entity's flank and back.",
    "TEAM reaches EMPLOYEE twice: two lines, two labels seated side by side, never merged into one.",
  ],
  "er/attribute-types": [
    "List~Item~ is drawn List<Item>, as mermaid's addText brackets a generic; one holding a comma keeps its tildes, Map~string,int~.",
    "string? is optional, decimal(10) sized, string[] an array, and a name may open on a *.",
    "文字列 名前 is measured in columns, not in characters, so the pipes stay aligned under the wide glyphs.",
  ],
  "er/entity-aliases": [
    "p[Person] draws the alias and keeps the id: the two relations are written on p and a, never on the words drawn.",
    "An alias takes quotes when it holds spaces, any unicode, and ::: dresses it the way it dresses a bare entity.",
  ],
  "er/top-to-bottom": [
    "direction TB stacks the chain. This package's default is LR, a decided divergence from mermaid's TB, see docs/divergences.md.",
    "The same three relations come out 74 columns wide on one row under the default, and 16 columns over 21 rows here.",
  ],
  "er/styles": [
    "Every way an ER source dresses a box, on one page: classDef default dresses them all, foo and bar ride the ::: shorthand on a relationship's ends, class NAMED-DRIVER hired is the statement form of that shorthand.",
    "style CAR lays a fill of its own over the default class: the ground bands one row in two, as mermaid lays it, the name then every other attribute row.",
    "stroke-width 4px recasts a ring heavy and stroke-dasharray dashes it, the two read together.",
    "A subgraph frame answers the same statement: style rental inks it blue and recasts it heavy, frame and box dressed alike.",
    "A cardinality is lexed by meaning, not by side: o{ on the left reads zero-or-many.",
  ],
  "er/attribute-keys-and-comments": [
    "Mermaid's named-driver example: an associative entity standing on its composite PK, FK keys alone.",
    "Typed to the letter: string[] arrays and string(99) lengths ride the type column, notes the last one.",
    "Two ways to write a relationship mix: symbols for allows and is, plain words for makes.",
  ],
  "er/customer-orders": [
    "Mermaid's classic order schema: eight relationships over seven entities, no attributes.",
    "A dashed line for the non-identifying has; quoted labels (liable for, ordered in) ride their runs.",
  ],
  "er/incident-ops": [
    "Entities carry their attribute blocks, keys and all.",
    "A key or a note opens a column of its own: the FKs line up, and status spells its enum in the comment slot.",
    "Teams own incidents, incidents emit audit logs, actions loop back to teams.",
  ],

  "state/basic": [
    "Entry and exit through [*].",
    "An error state loops back to Idle with retry.",
  ],
  "state/labels": [
    "`<br>` breaks a description in two, and the box is measured on the lines it makes.",
    "A markdown string `\"`**bold** _italic_`\"` comes out bold and italic, mermaid marking the label markdown.",
    "`#36;` is decoded before the drawing, so a dollar written as an entity code reaches the box.",
  ],
  "state/http-connection-lifecycle": [
    "A connection's life: closed, connecting, open, closing.",
    "A self-loop on Open for send/receive, a timeout falls back to Closed.",
  ],
  "state/tree": [
    "Five branches leave the start mark on one heavy spine, light past the last fork on each side.",
    "Smaller forks down the branches, Triage and Backlog splitting in two.",
    "Three exits reach the one end mark, each by the side facing where it comes from: face, top and bottom.",
  ],
  "state/composition": [
    "Two composites fed by one start, which sits between them on a double trunk.",
    "Each composite holds its own start and end, and its mark lands on the row of the run inside.",
    "A composite and a state renamed with a `:` description, drawn under their given names.",
    "A composite nested in a composite, its own `direction LR` kept, the whole content lined up on the middle of its box as mermaid seats it.",
  ],
  "state/pseudostates": [
    "A `<<choice>>` drawn as the bare diamond it is, its guards on the two branches, its id never written.",
    "A `<<fork>>` running the square root and the logarithm in parallel, a `<<join>>` gathering them, a head for each run.",
    "One end mark, reached after the report; False is a terminal state on its own.",
  ],
  "state/concurrency": [
    "Three regions cut by `--` inside Active, each a dashed box of its own with its own start mark.",
    "Each lock toggles between Off and On on the same event, the labels kept inside their region.",
    "No region names: a region's lid sits one row over its content, where a named box carries its title.",
  ],
  "state/notes": [
    "A note is a node of its own, a post-it shape tethered to its state by a dotted line without a head.",
    "`right of` puts the note in the layer after its state, `left of` in the layer before, as mermaid does.",
    "The block form `note ... end note` is read as one text, wrapped inside the post-it.",
  ],
  "state/links": [
    "`click Queued href \"...\"` hangs an OSC 8 hyperlink on the state: ctrl-click it in a terminal that carries them.",
    "The comma list `click Building,Published \"...\" \"the state syntax\"` links both states at once, the tooltip read and dropped.",
  ],
  "state/styles": [
    "Mermaid's own classDef example: `class Still notMoving`, `class Moving, Crash movement`, `class Crash badBadEvent`.",
    "A state wearing two classes keeps the props of both, the later over the earlier, as two css classes cascade.",
    "`fill` paints the inside of the box; `accTitle` and `accDescr` are read and dropped. `class end` names no state, so nothing is drawn for it, as in mermaid.",
  ],
  "state/change-lifecycle": [
    "Thirteen transitions through a change request's life.",
    "An evidence loop, a revoke path, two ways to end.",
    "The happy states wear a green classDef, the failing ones red, the evidence wait orange, mermaid's ::: spelling.",
  ],

};
