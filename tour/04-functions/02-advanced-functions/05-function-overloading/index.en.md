# Function Overloading

Cangjie supports function overloading, meaning you can define multiple functions with the same name as long as their parameter lists differ in number or type.

The compiler automatically selects the matching function version based on the argument types and count at the call site. This lets you use a unified function name to handle different types of input.

Function overloading provides a natural form of polymorphism. Callers don't need to remember different function names -- the compiler resolves the correct version at compile time.

The example defines multiple `format` functions that handle integer, float, and string parameters respectively.