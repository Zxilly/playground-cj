# mut Functions (Value Type Mutability)

Since structs are value types, regular methods cannot modify struct fields. To modify fields, declare the method as `mut func`.

`mut` methods can only be called on variables declared with `var`, because `let` variables are immutable and cannot be modified.

A `mut` method modifies the caller's own value. This differs from class methods -- classes are reference types where methods can directly modify object state.

In the example, the `Point` struct's `translate` method uses the `mut` modifier to move the point's coordinates.