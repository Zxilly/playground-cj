# Comparison Operator Overloading

Besides arithmetic operators, you can also overload **comparison operators** to enable `==`, `!=`, `<`, `>` and other comparisons for custom types.

The `==` operator is defined with `operator func ==(rhs: T): Bool`. Once `==` is defined, `!=` can typically be used automatically.

The `<` operator is defined with `operator func <(rhs: T): Bool`. Similarly, defining `<` allows other comparison operators (`>`, `<=`, `>=`) to be derived.

Comparison operators are essential for sorting, searching, and other common operations. The code on the right implements comparison operators for a `Temperature` type.
