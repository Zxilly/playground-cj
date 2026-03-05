# Generic Interfaces

Generic interfaces define a set of method signatures with type parameters. Any type that implements the interface must provide implementations of those methods for specific type parameters.

Generic interfaces are a powerful tool for abstraction and polymorphism. For example, you can define a `Container<T>` interface and have different data structures (lists, stacks, queues) all implement it, providing a uniform access pattern.

With generic interfaces, you can write generic code that doesn't depend on concrete types while maintaining full type safety.