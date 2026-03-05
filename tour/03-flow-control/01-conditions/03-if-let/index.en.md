# if-let

Cangjie supports using `let` pattern matching inside `if` conditions, known as the "if-let" pattern.

The syntax is `if (let pattern <- expression)`. When the expression's value matches the pattern, the condition is `true`, and variables bound in the pattern can be used inside the `if` branch.

This is particularly useful when working with `Option` types: you can unwrap and use the inner value directly when the match succeeds.

Multiple `let` patterns can be combined with `&&`. Note: when combined with `||`, variable bindings are not allowed.
