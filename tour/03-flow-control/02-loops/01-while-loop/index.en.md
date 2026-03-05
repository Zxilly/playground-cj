# while Loop

The `while` expression repeatedly executes the loop body as long as the condition is `true`.

The syntax is `while (condition) { body }`. The condition is checked before each iteration, and the loop exits when the condition is `false`.

Like `if`, the condition must be of type `Bool`. The type of a `while` expression is `Unit`.

Cangjie also supports `do-while` loops, which execute the body first, then check the condition, ensuring the body runs at least once.
