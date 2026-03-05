# Defining Structs

Structs are value types in Cangjie, used to group related data together. Define a struct with the `struct` keyword, containing fields and methods.

Struct fields are declared with `let` (immutable) or `var` (mutable). Each field requires a type annotation.

As value types, structs are copied when assigned or passed as arguments. Modifying a copy does not affect the original value.

The example defines a `Point` struct with `x` and `y` coordinate fields.
