export const CHART_NOTES: Record<string, string[]> = {
  "xychart/bar-chart": [
    "Quarterly bars against a titled, scaled y-axis.",
    "Values map straight to bar heights.",
  ],
  "xychart/horizontal": [
    "The same bar machinery lying down: xychart-beta horizontal.",
    "Categories read down the side, values along the width.",
  ],
  "xychart/line-chart": [
    "A week of temperatures as one line.",
    "The y-axis carries its own unit label.",
  ],
  "xychart/throughput": [
    "Bars and a line sharing the same axes.",
    "The line tracks just under the bar tops.",
  ],
  "xychart/bar-line-combo": [
    "Bar and line series on one scale.",
    "Identical values show how the two renderings align.",
  ],
  "xychart/point-labels": [
    "A week of active users as one line.",
    "A quoted text after a value labels its point: low and peak.",
  ],
  "xychart/data-labels": [
    "A week of open tickets as bars.",
    "showDataLabel writes each bar's value inside its top.",
  ],
  "xychart/data-labels-outside": [
    "The same tickets, the values moved off the bars.",
    "showDataLabelOutsideBar sets each value just above its bar.",
  ],
  "xychart/stacked-bars": [
    "Monthly deploys, the actual count over the target.",
    "A later bar series is drawn over the earlier one, and titled plots get a legend.",
  ],
  "xychart/crossing-lines": [
    "Database reads fall while cache reads climb.",
    "Two titled lines cross once, each named in the legend.",
  ],
  "xychart/negative-values": [
    "Headcount change per quarter, some quarters losing people.",
    "A y-axis range from -10 to 10 carries values below zero.",
  ],
  "xychart/reversed-axis": [
    "A league position climbing to first over six rounds.",
    "y-axis 10 --> 1 reverses the scale, so the best rank sits on top.",
  ],
  "xychart/horizontal-combo": [
    "Build minutes per repository, bars and a line lying down.",
    "xychart-beta horizontal turns the line along with the bars.",
  ],
  "xychart/sparkline": [
    "A bare trend line with no title, axis, tick or label.",
    "xAxis and yAxis in config.xyChart switch each part of both axes off.",
  ],
  "xychart/unicode-categories": [
    "Error rates per office, category names with accents, CJK and an emoji.",
    "Wide characters keep their columns, and small decimals set the scale's steps.",
  ],

  "gantt/basic": [
    "Two sections sharing one calendar.",
    "after chains a task to its predecessor.",
  ],
  "gantt/task-status-tags": [
    "Task states as tags: done, active, critical.",
    "Each state has a colour of its own, as it does in mermaid: grey when finished, the theme's own",
    "primary lightened when running, red when critical. A crit task keeps its state inside its red ends.",
  ],
  "gantt/milestones": [
    "Milestones as zero-length points between phases.",
    "Kickoff, code freeze and launch pin the plan.",
  ],
  "gantt/compact": [
    "displayMode: compact seats every task that fits beside another on one row: ten tasks in three.",
    "The margin is the section's alone, so the columns the task names held go to the span itself.",
    "A bar is its two ends and its name between them, so two tasks that touch never read as one long bar.",
    "A name too long for its bar goes beside it, and a milestone keeps the lozenge its one column is.",
  ],
  "gantt/excludes": [
    "mermaid's own example, with excludes weekends: each weekend is a band down the chart.",
    "A duration skips the excluded days, so a 3d opened on a Friday closes on the Wednesday; an end written as a date stays put.",
    "until isadded ends a task where another starts; a dateless task follows the one above it, even one waiting on after.",
  ],
  "gantt/product-launch": [
    "Every style a gantt can spell, on one launch plan.",
    "done, active, crit and milestones across four sections.",
    "A vert task pins a checkpoint; code freeze waits on two parents.",
  ],
  "gantt/reliability": [
    "A hardening quarter: discovery, build, launch.",
    "done, active, crit and a closing milestone in one chart.",
  ],

  "gantt/sprint-board": [
    "A month of tickets, twenty-eight rows over the whole of July.",
    "Half a day is spelled `0.5d` or `12h`, and comes out half the bar a day gets.",
    "Work sits on weekdays, so the four blank columns are July's weekends.",
    "Long ticket titles: watch the labels take their share of a narrow budget.",
  ],

  "gantt/dependencies": [
    "after with several ids waits for the latest of them: Android starts when both sync and push are done.",
    "until with several ids stops at the earliest of them: store assets end where the iOS build begins.",
    "A start can be after an id and the end a plain date, and until can point at a task written further down.",
  ],
  "gantt/working-calendar": [
    "weekend friday moves the weekend to Friday and Saturday, and excludes adds a holiday on Thursday the 19th.",
    "includes gives back Saturday the 21st: stock shelves opens on that Saturday and counts it as a working day.",
    "A duration skips the days off, so the four days of training close on the Wednesday before the holiday.",
  ],
  "gantt/time-of-day": [
    "A plan within one night: dateFormat carries the hour, and the durations are 30m, 1.5h and 90m.",
    "axisFormat %H:%M with tickInterval 1hour puts one tick on every hour, and the axis rolls over midnight.",
    "Past its hourly ticks the chart stops growing, so at 120 columns it is as wide as at 80.",
  ],
  "gantt/weekly-ticks": [
    "tickInterval 1week puts one tick on every week, and weekday monday makes those ticks fall on Mondays.",
    "axisFormat %b %e writes the dates as Mar  9, the single-digit day padded with a space as in d3.",
    "Where two labels would touch, one is left out and its tick stays.",
  ],
  "gantt/vert-markers": [
    "Three vert markers: each is a line down the whole chart, takes no row in its section, and has its name under the dates.",
    "A marker crosses a running bar without breaking it: Schedule out cuts through Draft slides.",
    "At 40 columns the names would touch, so each goes on a line of its own.",
  ],
  "gitgraph/basic": [
    "One branch out, work on it, merge back.",
    "The trunk keeps its own commits meanwhile.",
  ],
  "gitgraph/feature-branches": [
    "Two feature branches in flight at once.",
    "Both merge back to main in order.",
  ],
  "gitgraph/payments": [
    "Named commits tell the story, baseline to alpha.1.",
    "A redesign branch and a hotfix both land on main.",
  ],

  "gitgraph/commit-types": [
    "Every commit has an id, and the id is written under its marker.",
    "type: REVERSE draws ✖ and type: HIGHLIGHT draws □, next to plain NORMAL ●.",
    "A bad index undone, then its fix marked out, on one trunk.",
  ],
  "gitgraph/tags": [
    "tag: puts a release name in brackets above the commit, [v1.0.0] on main.",
    "A tag works on a branch too: the release candidate is tagged on release-1.1.",
    "The merge carries its own id and tag, ship-1.1 shipped as [v1.1.0].",
  ],
  "gitgraph/merge-options": [
    "A merge takes id:, tag: and type: like a commit does, in any order.",
    "type: HIGHLIGHT marks the merge that brings the cache in, type: REVERSE the one that takes it out.",
    "The vertical at each merge column joins the merged line to main.",
  ],
  "gitgraph/cherry-pick": [
    "cherry-pick id: copies one commit from develop onto main, without merging the branch.",
    "The vertical rises at the pick's column, from the develop line to main.",
    "The copy is written fix-login-cherry. A tag: names the copy, and the v2.0.1 patch release is tagged on it.",
  ],
  "gitgraph/branch-names": [
    "A branch name can hold slashes, dots and dashes: feature/search-v2.1 is written bare.",
    "A name that is also a keyword, like \"cherry-pick\", is quoted everywhere it is used.",
    "switch and checkout are the same statement, and the gutter widens to fit the longest name.",
  ],
  "gitgraph/branch-order": [
    "order: sets the lane: hotfix is created last and drawn first, develop is created first and drawn last.",
    "main always keeps the top lane.",
    "Only hotfix merges back, so release and develop end where their work stops.",
  ],
  "gitgraph/top-to-bottom": [
    "gitGraph TB: stands the graph up: branches become columns, time runs down.",
    "Branch names sit on top, and each commit's id is written under its marker.",
    "The feature branches off, then merges back into main as auth.",
  ],
  "journey/basic": [
    "A working day scored task by task, 1 to 5.",
    "Actors are listed beside each step.",
  ],
  "journey/onboarding-flow": [
    "A new hire's first week, scored per step.",
    "Sections split day one from week one.",
  ],
  "journey/customer-launch": [
    "A customer's path from discovery to adoption.",
    "Scores show where the journey hurts.",
  ],

  "pie/basic": ["Four shares, largest first.", "One in ten for the smallest."],
  "pie/budget-breakdown": [
    "A quarter's budget in five shares.",
    "The smallest slice is one twentieth.",
  ],
  "pie/cloud-cost": [
    "A cloud bill in four shares.",
    "Compute leads, storage and observability tie.",
  ],

  "pie/show-data": [
    "showData on the header line prints each slice's value after its share: [128] next to 41.8%.",
    "The title comes after showData on the same line, as mermaid's grammar orders them.",
  ],
  "pie/decimal-shares": [
    "Decimal values, each share landing on a half.",
    "The bar rounds as mermaid's slice label does, 37.5 shows 38%, so the four labels sum to 102.",
    "The legend keeps one decimal: 37.5%, 32.5%, 17.5%, 12.5%.",
  ],
  "pie/many-slices": [
    "Ten slices over eight shade glyphs: Spain wears United States' fill again, Mexico Germany's.",
    "A segment too narrow for its name keeps the percent alone, and one under 4 cells shows nothing under it.",
  ],
  "pie/tiny-slices": [
    "Three slices under 1 % each leave the bar, as mermaid leaves them out of its circle.",
    "The legend still tells them apart: 0.1%, 0.2%, 0.5%.",
    "Healthy fills the whole bar, 40 cells for 99.1%.",
  ],
  "pie/labels": [
    "#amp; in the title and #9829; in a label become & and ♥; C# without a semicolon stays text.",
    "A colon inside the quotes stays in the label, and so does %%: it opens no comment there.",
    "Accents and 🥐 are measured in columns, so every name lines up on the bar wall.",
  ],
  "pie/comments": [
    "A comment above the header, one in the body, one after a value: all three dropped.",
    "title on its own line below pie draws the same heading as one written on the header.",
  ],
  "pie/init-directive": [
    "An init directive above the header sets the theme: forest greens the slices.",
    "Only theme and themeVariables count; every other key the directive carries is ignored.",
  ],
  "architecture/service-group": [
    "Three services in one cloud group.",
    "Ports name which side each edge leaves and enters.",
  ],
  "architecture/nested-groups": [
    "A group nested inside another.",
    "Edges reach through group borders, sides picked by port.",
  ],

  "mindmap/tidy-tree": [
    "A product launch in five workstreams, under mermaid's `layout: tidy-tree`.",
    "Branches alternate: the first, third and fifth on the left, the others on the right, each side read down; nothing above or below the root.",
  ],
  "mindmap/basic": [
    "A project split three ways, two levels deep.",
    "Branches spread around the root.",
  ],
  "mindmap/incident-program": [
    "An incident program in three branches.",
    "Detection, response and learning each carry two leaves.",
  ],
  "mindmap/checkout-migration": [
    "A checkout platform moved onto Kubernetes: seven workstreams, fifty-odd nodes, three levels deep.",
    "Wide, the workstreams go all round the root; narrower, they fold onto its two sides; at 40 columns, the indented tree.",
  ],

  "mindmap/deep-nesting": [
    "Seven levels, from the cloud down to a container, one spine segment per level.",
    "A short second branch, Edge, shows the root splitting before the long chain runs on.",
  ],
  "mindmap/many-children": [
    "Twelve branches dealt round one root, clockwise from its right, a fan above and one below.",
    "Eleven colours for twelve branches: the one that comes back goes to the two facing each other across the root.",
    "The branch order stays as written, the first four on the left, top to bottom.",
  ],
  "mindmap/indentation": [
    "The root is indented eight spaces, and that column becomes the base level.",
    "Return sits at 14, between two levels, and attaches to Flights, the last line indented less than it, as mermaid does.",
    "A blank line is skipped, and Airport pickup at three spaces deeper is still one level down.",
  ],
  "mindmap/node-shapes": [
    "Square, rounded, circle, cloud and hexagon are all read, and the brackets are dropped: no node has a border here.",
    "An id before a shape is never drawn, and two nodes can share one, api twice under Serving.",
    "{{Storage}} and ((Warehouse)) have no id, and mermaid accepts that too.",
  ],
  "mindmap/unicode-labels": [
    "Accented, CJK, Hangul, Arabic and Hebrew labels, measured in columns so every spine lines up.",
    "#amp; and #10004; are decoded before parsing, to & and a check mark.",
  ],
  "mindmap/comments": [
    "Comments above the header, above the root, between children and after a shaped node leave no trace in the tree.",
    "A single % in a label is plain text, as in 20% and 99.9% SLO.",
  ],
  "quadrant/basic": [
    "Effort against impact, four labelled quadrants.",
    "Four items plotted by coordinates.",
  ],
  "quadrant/roadmap-bets": [
    "Roadmap bets placed on effort and impact.",
    "The quadrant labels carry the decision.",
  ],

  "timeline/basic": [
    "Years as sections, months as entries.",
    "The ribbon reads left to right.",
  ],
  "timeline/reliability-roadmap": [
    "Five years, one milestone each.",
    "Long entries hold together along the ribbon.",
  ],
  "timeline/left-to-right": [
    "timeline LR keeps the ribbon across even at 40 columns, where the same source without it turns down.",
    "The right arrow closes the axis once the last period is placed.",
  ],
  "timeline/top-to-bottom": [
    "timeline TD stacks the periods on a trunk, one bullet each, at every width.",
    "Each section opens on a ══ name ══ rule, and its events sit under their period.",
  ],
  "timeline/periods-without-events": [
    "A period can stand alone: Lease signed has no event and keeps its own column.",
    "Bare periods and periods with an event share one row of equal widths.",
  ],
  "timeline/section-colours": [
    "Eight sections take the eight band colours, one each.",
    "At 120 the bands run across; at 80 and below each section rule is inked in its band colour.",
  ],
  "timeline/unicode-and-entities": [
    "#amp; and #quot; become & and \", as mermaid decodes them.",
    "Accents, an emoji and CJK or Hangul text are measured in columns, so every column stays centred.",
  ],
  "timeline/init-directive": [
    "An %%{init}%% directive above the header sets theme and three cScale seats, and wins over the frontmatter.",
    "Triage, Work and Close take green, orange and blue; any other config key in the directive is ignored.",
  ],

  "block/basic-grid": [
    "Six labelled blocks on a three-column grid.",
    "No edges: alignment is the whole message.",
  ],
  "kanban/basic": [
    "Three columns, tasks as cards.",
    "Todo, in progress, done at a glance.",
  ],
  "packet/udp-header": [
    "The UDP header, field by field over bit ranges.",
    "Four 16-bit fields, then the data.",
  ],
  "treemap/basic": [
    "A company sized by value: departments hold their teams.",
    "Engineering outweighs product and design together.",
  ],
};
