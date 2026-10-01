# mermaid2term

## Reuse before creating

Before writing a variant (helper, component, per-diagram flavour), look for existing code that already does the job or can be adapted cheaply. Reuse or extend it rather than adding a new one.

## Code duplicated across diagram types

When a behaviour differs or has been duplicated between two diagram types, check that mermaid makes the same distinction. If mermaid does not, it is only legitimate as a decided divergence written in `docs/divergences.md`. Anything else that differs from mermaid is a gap, not a choice.
