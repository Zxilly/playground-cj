# Type Constraints

Sometimes we need generic type parameters to have certain capabilities. Type constraints let you restrict a generic parameter to types that implement a specific interface, allowing you to call methods defined by that interface in your generic code.

In Cangjie, the `<:` symbol is used to express type constraints. For example, `T <: ToString` means type `T` must implement the `ToString` interface.

Type constraints ensure type safety in generic code -- the compiler checks that all constraints are satisfied at compile time.
