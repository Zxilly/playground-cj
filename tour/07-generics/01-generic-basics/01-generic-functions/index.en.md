# Generic Functions

Generic functions allow you to write functions that can operate on multiple types without writing a separate version for each type. By declaring a type parameter using angle brackets `<T>` after the function name, you can use that type parameter throughout the function body.

When calling a generic function, the compiler can usually infer the type parameter automatically from the arguments you pass. You can also explicitly specify the type parameter at the call site if needed.

Generic functions are an essential tool for code reuse. The example demonstrates an `identity` function and a `makePair` function that work with any type of argument.
