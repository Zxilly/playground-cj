# Type Inference

Cangjie has powerful type inference. In most cases, the compiler can automatically infer a variable's type from the assigned expression without explicit annotations.

Integer literals default to `Int64`, and floating-point literals default to `Float64`. If you need a different type, use a type annotation.

Type inference makes code more concise while maintaining the safety of static typing. The compiler checks all types at compile time to ensure type safety.
