import { describe, it, expect } from "vitest";
import { render } from "../../src/index.js";
import { NEWLINE } from "../../src/text/chars.js";
import { widest } from "../support/drawn.js";

// The fold search picks its folds one notch at a time and undoes those that did not narrow the drawing: these
// drawings freeze the folds it keeps, so a faster search cannot quietly land on others.
describe("the label fold search keeps the same folds, TD and LR, whether a fold fits the budget or none does", () => {
  const source = (direction: string): string =>
    [
      `flowchart ${direction}`,
      "  A[start the whole night shift] --> B[charge the customer card now]",
      "  A --> C[put the whole order on backorder]",
      "  B --> D[pick and pack the parcel today]",
      "  C --> D",
    ].join(NEWLINE);

  const cases: ReadonlyArray<{ direction: string; width: number; fits: string; rows: string[] }> = [
    {
      direction: "TD",
      width: 40,
      fits: "a fold that fits",
      rows: [
        "         ┌───────────────────┐",
        "         │  start the whole  │",
        "         │    night shift    │",
        "         │                   │",
        "         └─────┬───────┬─────┘",
        "               │       │",
        "         ╭─────╯       ╰──────╮",
        "         ⏷                    ⏷",
        "┌────────────────┐   ┌────────────────┐",
        "│   charge the   │   │ put the whole  │",
        "│ customer card  │   │    order on    │",
        "│      now       │   │   backorder    │",
        "└────────┬───────┘   └────────┬───────┘",
        "         │                    │",
        "         ╰──────╮     ╭───────╯",
        "                ⏷     ⏷",
        "         ┌───────────────────┐",
        "         │   pick and pack   │",
        "         │ the parcel today  │",
        "         │                   │",
        "         └───────────────────┘",
      ],
    },
    {
      direction: "TD",
      width: 16,
      fits: "no fold that fits",
      rows: [
        "   ┌────────────────┐",
        "   │start the whole │",
        "   │  night shift   │",
        "   │                │",
        "   └────┬──────┬────┘",
        "        │      │",
        "     ╭──╯      ╰───╮",
        "     ⏷             ⏷",
        "┌─────────┐   ┌─────────┐",
        "│ charge  │   │   put   │",
        "│   the   │   │   the   │",
        "│customer │   │  whole  │",
        "│  card   │   │  order  │",
        "│   now   │   │   on    │",
        "│         │   │backorder│",
        "└────┬────┘   └────┬────┘",
        "     │             │",
        "     ╰───╮     ╭───╯",
        "         ⏷     ⏷",
        "   ┌────────────────┐",
        "   │ pick and pack  │",
        "   │the parcel today│",
        "   │                │",
        "   └────────────────┘",
      ],
    },
    {
      direction: "LR",
      width: 40,
      fits: "a fold that fits",
      rows: [
        "          ┌─────────────┐",
        "          │ charge the  │",
        "        ╭⏵│customer card├──╮",
        "┌─────┐ │ │     now     │  │  ┌────────┐",
        "│start├─╯ └─────────────┘  │  │pick and│",
        "│ the │                    ╰─⏵│  pack  │",
        "│whole│                       │  the   │",
        "│night│                    ╭─⏵│ parcel │",
        "│shift├─╮ ┌─────────────┐  │  │ today  │",
        "└─────┘ │ │put the whole│  │  └────────┘",
        "        ╰⏵│  order on   ├──╯",
        "          │  backorder  │",
        "          └─────────────┘",
      ],
    },
    {
      direction: "LR",
      width: 16,
      fits: "no fold that fits",
      rows: [
        "          ┌─────────────┐",
        "          │ charge the  │",
        "┌─────┐ ╭⏵│customer card├──╮  ┌──────┐",
        "│start│ │ │     now     │  │  │ pick │",
        "│ the ├─╯ └─────────────┘  │  │ and  │",
        "│whole│                    ╰─⏵│ pack │",
        "│night│                       │ the  │",
        "│shift│                    ╭─⏵│parcel│",
        "│     ├─╮ ┌─────────────┐  │  │today │",
        "└─────┘ │ │put the whole│  │  └──────┘",
        "        ╰⏵│  order on   ├──╯",
        "          │  backorder  │",
        "          └─────────────┘",
      ],
    },
  ];

  for (const { direction, width, fits, rows } of cases) {
    it(`keeps the same folds in ${direction} at ${width}, ${fits}`, () => {
      expect(render(source(direction), { width }).split(NEWLINE)).toEqual(rows);
    });
  }
});

// A tree too wide for its budget: most folds leave every box where it stood, the routes drawn for one layout are
// replayed for the next, and the words each box keeps on each row stay the ones the search chose.
describe("the label fold search keeps the same folds on a tree no fold fits, TD and LR", () => {
  const body = [
    "  n0[alpha delta golf]",
    "  n1[bravo echo hotel charlie]",
    "  n2[charlie foxtrot alpha delta golf]",
    "  n3[delta golf bravo]",
    "  n4[echo hotel charlie foxtrot]",
    "  n5[foxtrot alpha delta golf bravo]",
    "  n6[golf bravo echo]",
    "  n7[hotel charlie foxtrot alpha]",
    "  n8[alpha delta golf bravo echo]",
    "  n9[bravo echo hotel]",
    "  n10[charlie foxtrot alpha delta]",
    "  n11[delta golf bravo echo hotel]",
    "  n12[echo hotel charlie]",
    "  n0 --> n1",
    "  n0 --> n2",
    "  n0 --> n3",
    "  n1 --> n4",
    "  n1 --> n5",
    "  n1 --> n6",
    "  n2 --> n7",
    "  n2 --> n8",
    "  n2 --> n9",
    "  n3 --> n10",
    "  n3 --> n11",
    "  n3 --> n12",
  ];
  const wordsByRow = (drawn: string): string[] =>
    drawn
      .split(NEWLINE)
      .map((row) => (row.match(/[a-z]+(?: [a-z]+)*/gu) ?? []).join(" | "))
      .filter((row) => row !== "");

  const cases: ReadonlyArray<{ direction: string; wide: number; tall: number; words: string[] }> = [
    {
      direction: "TD",
      wide: 170,
      tall: 27,
      words: [
        "alpha delta golf",
        "bravo echo hotel | charlie foxtrot",
        "charlie | alpha delta golf | delta golf bravo",
        "echo hotel | foxtrot alpha | hotel charlie | alpha delta golf | charlie foxtrot | delta golf bravo | echo hotel",
        "charlie foxtrot | delta golf bravo | golf bravo echo | foxtrot alpha | bravo echo | bravo echo hotel | alpha delta | echo hotel | charlie",
      ],
    },
    {
      direction: "LR",
      wide: 52,
      tall: 53,
      words: [
        "echo hotel",
        "charlie foxtrot",
        "bravo echo hotel | foxtrot alpha",
        "charlie | delta golf bravo",
        "golf bravo echo",
        "hotel charlie",
        "foxtrot alpha",
        "alpha | charlie foxtrot | alpha delta golf",
        "delta | alpha delta golf | bravo echo",
        "golf",
        "bravo echo hotel",
        "charlie foxtrot",
        "alpha delta",
        "delta golf bravo",
        "delta golf bravo | echo hotel",
        "echo hotel",
        "charlie",
      ],
    },
  ];

  for (const { direction, wide, tall, words } of cases) {
    it(`keeps the same words on each row in ${direction} at 40`, () => {
      const drawn = render([`flowchart ${direction}`, ...body].join(NEWLINE), { width: 40 });
      expect(widest(drawn)).toBe(wide);
      expect(drawn.split(NEWLINE)).toHaveLength(tall);
      expect(wordsByRow(drawn)).toEqual(words);
    });
  }
});
