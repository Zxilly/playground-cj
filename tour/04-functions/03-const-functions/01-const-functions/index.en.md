# const Functions & Compile-time Evaluation

Cangjie supports `const` functions, which can be evaluated at compile time. When a function marked with `const` is called with arguments known at compile time, the compiler computes the result during compilation.

`const` functions are restricted to expressions that can be evaluated at compile time and cannot have side effects such as I/O operations.

The benefit of compile-time evaluation is zero runtime overhead -- the result is determined at compile time. This is useful for constant expressions, mathematical computations, and similar scenarios.

The example defines a `const` factorial function whose result can be computed at compile time. In `main`, we show both compile-time and runtime usage.