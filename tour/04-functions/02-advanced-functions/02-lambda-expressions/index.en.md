# Lambda Expressions

Lambda expressions are a concise way to write anonymous functions. The syntax is `{ params => body }`, where the parameter list includes names and types.

When a lambda has no parameters, use `{ => body }`. When the body is a single expression, its value is automatically used as the lambda's return value.

Lambdas are commonly used where a short function is needed, such as an argument to a higher-order function. They avoid the overhead of defining a standalone function for simple one-off logic.

The example shows different forms of lambda expressions, including assigning them to variables and using them as function arguments.
