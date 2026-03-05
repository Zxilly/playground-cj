# Defining Interfaces

Interfaces define a set of method signatures without providing implementations. They describe the behavioral capabilities a type should have.

Use the `interface` keyword to define interfaces containing method declarations. Interfaces can also include methods with default implementations.

Interfaces are a key mechanism for polymorphism. Multiple unrelated classes can implement the same interface and be treated uniformly. Unlike inheritance, a class can implement multiple interfaces.

The example defines `Printable` and `Describable` interfaces.