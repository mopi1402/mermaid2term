## target

Mermaid diagrams drawn as readable Unicode art in a terminal: the types hold and the three geometric invariants of the routed edges hold, checked in seconds on every done.

## non-goals

- Byte parity with the reference: it is read, not obeyed.
- The readable takes (tsx scripts/ourtakes.ts --check) and the suite (pnpm test): too slow for a gate run on every done, they stay in pnpm verify. The drawings themselves are frozen in the gate by `pnpm frozen`, as hashes.
- The playground's own typecheck and suite: run by pnpm verify, not by this gate.

## hard-constraints

- Nothing is pushed without the human's word.
- No AI attribution or mention in anything versioned: commits, PRs, docs, code.
- Mermaid-native syntax and config only: nothing is offered beyond what mermaid itself does, save keys prefixed `m2t_`, the last resort for what mermaid cannot reach, each one given its section in `docs/divergences.md`.
- A gate check must stay fast: a few seconds, never a quarter of a minute.

## done-when

```yaml
# tsc over src, tests and scripts stays green: no type lies and no broken import, the cheapest whole-program check the repo has.
- id: typecheck-green
  verify: pnpm typecheck
  pass-if: exit == 0
# Every arrowhead is fed straight: the cell a head points away from continues its direction, so no corner is eaten by a head. Checked on the crossing fan in every stroke across a sweep of widths the frozen takes never cover.
- id: arrowheads-fed-straight
  verify: pnpm arrows
  pass-if: exit == 0
# Every drawn edge keeps at least one glyph carrying its style, plain, dotted or thick, down the whole compaction ladder both ways: an edge reduced to heads and corners alone cannot be told apart.
- id: strokes-stay-visible
  verify: pnpm strokes
  pass-if: exit == 0
# Two edges never share a cell along one axis; a right-angle crossing stays two lines. A reader following an edge back must always reach the box it left.
- id: edges-never-merge
  verify: pnpm merges
  pass-if: exit == 0
# A wall's free part shows the fill it closes: an edge glyph ▏▕▁▔ half-drawn beside a filled blank carries that blank's ground, never the page's. Held on every source padless on dracula; the three modes and four themes stay in the suite (tests/invariants).
- id: walls-keep-their-ground
  verify: pnpm grounds
  pass-if: exit == 0
# No drawing moves unless it was meant to: every corpus source, in the three border modes, at widths 40 and 80, under a neutral, a mirrored light and a mirrored dark theme, hashes as frozen in fixtures/frozen.json. A change anywhere shows on every kind it reaches; a wanted one is refrozen with pnpm frozen:update and its diff read.
- id: drawings-frozen
  verify: pnpm frozen
  pass-if: exit == 0
# No code is copied to keep a change from reaching another kind: a block of src/ that repeats another, names changed or not, fails unless the baseline already holds it. What is shared is written once and reused.
- id: no-new-clones
  verify: pnpm clones
  pass-if: exit == 0
# Nothing is left behind unread: a file no entry reaches, an export nothing imports or a dependency nothing uses fails. What a change stops using goes with it.
- id: no-dead-code
  verify: pnpm deadcode
  pass-if: exit == 0
```
