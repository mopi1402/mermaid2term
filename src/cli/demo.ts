import { render, renderThemedText } from "../index.js";
import { printToConsole } from "../paint/ansi.js";
import { must } from "../must.js";
import { FAILED, OK, err, out } from "./exits.js";
import { consoleWidth, useColor } from "./console.js";
import { themeChosen } from "./ground.js";
import { ALL, type Args } from "./args.js";

const DEMO_SOURCES: ReadonlyMap<string, readonly [string, string]> = new Map([
  [
    "flowchart",
    ["Flowchart", "graph TD\n  A[Start] --> B{Decision}\n  B -->|Yes| C[Process]\n  B -->|No| D[End]\n  C --> D"],
  ],
  [
    "sequence",
    [
      "Sequence diagram",
      "sequenceDiagram\n  Client->>Server: GET /api\n  Server->>DB: SELECT\n  DB-->>Server: rows\n  Server-->>Client: 200 JSON",
    ],
  ],
  [
    "class",
    [
      "Class diagram",
      "classDiagram\n  class Animal {\n    +String name\n    +makeSound()\n  }\n  class Dog {\n    +fetch()\n  }\n  Animal <|-- Dog",
    ],
  ],
  ["er", ["ER diagram", "erDiagram\n  CUSTOMER ||--o{ ORDER : places\n  ORDER ||--|{ ITEM : contains"]],
  [
    "state",
    ["State diagram", "stateDiagram-v2\n  [*] --> Idle\n  Idle --> Running : start\n  Running --> Done : complete\n  Done --> [*]"],
  ],
  ["block", ["Block diagram", "block-beta\n  columns 3\n  Frontend API Database"]],
  [
    "git",
    ["Git graph", "gitGraph\n  commit\n  branch develop\n  commit\n  commit\n  checkout main\n  merge develop\n  commit"],
  ],
  ["pie", ["Pie chart", 'pie title Languages\n  "TypeScript" : 45\n  "Go" : 30\n  "Rust" : 25']],
  [
    "treemap",
    ["Treemap", 'treemap-beta\n  "Backend"\n    "API": 35\n    "Auth": 15\n  "Frontend"\n    "React": 30\n    "CSS": 10'],
  ],
  [
    "mindmap",
    [
      "Mindmap",
      "mindmap\n  Project\n    Design\n      Wireframes\n      Mockups\n    Development\n      Frontend\n      Backend\n    Testing",
    ],
  ],
  [
    "timeline",
    [
      "Timeline",
      "timeline\n    title Roadmap\n    section Q1\n        Research : Analysis\n        Design : Wireframes\n    section Q2\n        Build : Frontend, Backend\n        Launch : Beta",
    ],
  ],
  [
    "kanban",
    [
      "Kanban",
      "kanban\n    Todo\n        Design homepage\n        Fix login bug\n    In Progress\n        API integration\n    Done\n        Project setup",
    ],
  ],
  [
    "journey",
    [
      "User journey",
      "journey\n    title My working day\n    section Go to work\n        Make tea: 5: Me\n        Go upstairs: 3: Me\n        Do work: 1: Me, Cat\n    section Go home\n        Go downstairs: 5: Me\n        Sit down: 5: Me",
    ],
  ],
  [
    "xychart",
    [
      "XY chart",
      'xychart-beta\n    title "Monthly Revenue"\n    x-axis [Jan, Feb, Mar, Apr, May, Jun]\n    y-axis "Revenue (k)"\n    bar [12, 18, 25, 20, 30, 35]',
    ],
  ],
  [
    "quadrant",
    [
      "Quadrant chart",
      "quadrantChart\n    title Priority Matrix\n    x-axis Low Effort --> High Effort\n    y-axis Low Impact --> High Impact\n    quadrant-1 Do First\n    quadrant-2 Schedule\n    quadrant-3 Delegate\n    quadrant-4 Eliminate\n    Task A: [0.3, 0.8]\n    Task B: [0.8, 0.9]\n    Task C: [0.2, 0.2]",
    ],
  ],
]);

export function runDemo(args: Args, background: string | undefined): number {
  const demoType = (must(args.demo)).toLowerCase();
  let keys: string[];
  if (demoType === ALL) keys = [...DEMO_SOURCES.keys()];
  else if (DEMO_SOURCES.has(demoType)) keys = [demoType];
  else {
    err(`Unknown demo type: ${demoType}`);
    err(`Available: all, ${[...DEMO_SOURCES.keys()].join(", ")}`);
    return FAILED;
  }

  const color = useColor();
  for (const key of keys) {
    const [title, source] = must(DEMO_SOURCES.get(key));
    out(`=== ${title} ===`);
    if (color) {
      const painted = renderThemedText(source, background === undefined ? {} : { background }, themeChosen(args));
      process.stdout.write(printToConsole(painted, consoleWidth()));
    }
    else out(render(source));
    out("");
  }

  return OK;
}
