# Type Casting

When you have a value of an interface type or base class type but need to access functionality specific to a concrete subtype, use type casting.

In Cangjie, use the `is` operator to check whether an object belongs to a type, and use type matching in pattern matching for safe type conversion.

Type casting is a downcast operation, converting from a more general type to a more specific one. If the object's actual type doesn't match, the match fails.

The example shows how to perform safe type casting using pattern matching.
