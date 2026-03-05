# Pattern Guard

Pattern guards use the `where` keyword to add an additional boolean condition after a pattern match succeeds.

The syntax is `case pattern where condition =>`. The branch executes only when the pattern matches AND the `where` condition is `true`.

Pattern guards let you add finer-grained conditional control on top of pattern matching.
