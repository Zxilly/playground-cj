# Range Expression

A Range represents a sequence with a fixed step, commonly used in `for-in` loops.

Cangjie has two range literal forms:

- **Half-open**: `start..end` -- includes `start`, excludes `end`
- **Closed**: `start..=end` -- includes both `start` and `end`

You can specify a step with `: step`, e.g. `0..10 : 2`. The step defaults to `1` and cannot be `0`. Negative steps create descending sequences.
