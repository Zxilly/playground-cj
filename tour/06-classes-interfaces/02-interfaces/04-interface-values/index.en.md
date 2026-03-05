# Interface Values

Interface types can be used as variable types to store any object implementing that interface. Such variables are called interface values.

At runtime, an interface value holds a reference to a concrete object along with its type information. Method calls through interface values are dynamically dispatched to the concrete type's implementation.

Interface values can be used in arrays, function parameters, and return values, enabling type abstraction and decoupling.

The example shows how to store objects of different types as interface values and use them.
