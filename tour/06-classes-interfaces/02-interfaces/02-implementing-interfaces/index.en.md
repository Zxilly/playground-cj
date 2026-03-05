# Implementing Interfaces

Classes implement interfaces using the `<:` syntax and must provide implementations for all interface methods. A class can implement multiple interfaces, connected with `&`.

When implementing an interface, a class must provide method implementations matching the interface's method signatures exactly. If an interface has default implementations, the class can optionally override them.

Structs can also implement interfaces, using the same syntax as classes. This allows both value types and reference types to participate in interface-based polymorphism.

The example shows multiple classes implementing the same interface.
