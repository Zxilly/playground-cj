# Functions as Values

In Cangjie, functions are first-class values. They can be assigned to variables, passed as arguments, or returned from other functions.

Function types are written as `(ParamTypes) -> ReturnType`. For example, `(Int64) -> Int64` represents a function that takes an `Int64` and returns an `Int64`.

To assign a function to a variable, use the function name without parentheses. The variable's type is the corresponding function type.

Passing functions as arguments is the foundation of higher-order programming. In the example, the `apply` function takes a function parameter and an integer, applying the function to the integer.