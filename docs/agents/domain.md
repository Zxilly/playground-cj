# Domain Docs

This repo uses a single domain context.

## Before exploring, read these

- `CONTEXT.md` at the repo root for domain language.
- `docs/adr/` for architectural decisions that touch the area being changed.

If any of these files do not exist, proceed silently. Do not suggest creating them upfront; producer workflows create them lazily when terms or decisions are resolved.

## File structure

```text
/
├── CONTEXT.md
├── docs/
│   └── adr/
└── src/
```

## Use the glossary's vocabulary

When output names a domain concept, use the term as defined in `CONTEXT.md`. Do not drift to synonyms the glossary explicitly avoids.

If a needed concept is not in the glossary yet, either reconsider the wording or note the gap for `grill-with-docs`.

## Flag ADR conflicts

If output contradicts an existing ADR, surface it explicitly instead of silently overriding it.
