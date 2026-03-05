# Recursive Enums

Enum members can contain data of the enum type itself, forming recursive enums. This is useful for representing recursive data structures like trees or expressions.

Recursive enums are typically used with recursive functions, using pattern matching to decompose the structure layer by layer until reaching a base case.

The example defines a simple arithmetic expression type `Expr`, where `Add` and `Mul` members contain two sub-expressions and `Num` is the base case. The `eval` function recursively computes the expression's value.