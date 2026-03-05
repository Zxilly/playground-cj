# Struct Methods

Structs can define methods to operate on their data. Methods are defined inside the struct with the `func` keyword and can access the struct's fields via `this`.

Regular methods are read-only and cannot modify the struct's fields. To modify fields, use the `mut` modifier (covered in the next section).

Methods are called using dot syntax, e.g., `instance.methodName()`. Methods can have parameters and return values, just like regular functions.

In the example, the `Circle` struct defines methods to compute area and circumference.
