# Option & Pattern Matching

Pattern matching is the most common way to handle `Option` values. With a `match` expression, you can handle both `Some` and `None` cases, directly extracting the inner value in the `Some` branch.

The compiler ensures you handle all possible cases, warning if a branch is missing. This exhaustiveness checking is a key part of `Option`'s type safety guarantees.

Pattern matching can be used not only in `match` expressions but also in `if-let` scenarios for more concise syntax.
