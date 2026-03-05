# Nested Functions

Cangjie allows defining functions inside other functions, called nested functions. Nested functions are only visible within their enclosing function's scope.

Nested functions can access variables and parameters of their enclosing function, forming closures. This makes them ideal for encapsulating helper logic used only within a specific function.

Using nested functions avoids exposing internal helper functions at the module level, keeping code encapsulated and clean.

In the example, the `processNumbers` function defines nested helper functions to handle different parts of the computation.