# Defining Functions

In Cangjie, functions are defined using the `func` keyword. Functions are the basic units of code organization, accepting input parameters and optionally returning results.

The basic syntax is: `func name(param: Type): ReturnType { body }`. If a function has no return value, the return type is `Unit`, which can be omitted.

The example defines an `add` function that takes two `Int64` parameters and returns their sum. When the function body is a single expression, its value is automatically used as the return value. You can also use `return` to explicitly return a value.

You can also define functions with no parameters or no return value. The `sayHello` function takes no arguments and simply prints a greeting.