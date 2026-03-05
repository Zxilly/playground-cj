# Basic match

The `match` expression is a powerful pattern matching tool in Cangjie, similar to `switch` in other languages but much more capable.

The basic syntax is `match (expression) { case pattern => code ... }`. The program compares the value against each `case` pattern in order. When a match succeeds, the corresponding code executes and the `match` exits.

`match` requires exhaustive matching -- all possible values must be covered. The wildcard pattern `_` is typically used as the last branch to match all remaining cases.
