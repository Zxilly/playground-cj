# Named Parameters

Cangjie supports named parameters to make function calls more readable. When defining a function, append `!` to a parameter name to mark it as a named parameter.

When calling the function, named parameters require the parameter name at the call site, in the form `name: value`. This improves readability, especially when a function has multiple parameters of the same type, preventing confusion about parameter order.

Named parameters can be passed in any order since the caller explicitly specifies each parameter's name.

In the example, the `createUser` function uses named parameters to clearly indicate the meaning of each argument.
