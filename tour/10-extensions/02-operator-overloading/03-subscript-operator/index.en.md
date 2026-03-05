# Subscript Operator Overloading

The **subscript operator** `[]` allows you to access elements of a custom type using index syntax, just like arrays. It is defined with `operator func [](index: T): R`.

The subscript operator is useful for:
- Custom collection types
- Matrices and multi-dimensional data structures
- Dictionary or map types

You can define both read-only and read-write versions of the subscript operator. The code on the right shows a simple `Matrix` type that uses subscript operators to access elements.
