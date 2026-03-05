# Generic Classes

Generic classes are similar to generic structs but support inheritance and reference semantics. Generic classes are commonly used to implement reusable data structures like stacks, queues, and more.

In the example below, we implement a generic `Stack` class. It uses an `ArrayList` internally to store elements and provides `push`, `pop`, and `peek` methods. Because it uses generics, this stack can store elements of any type.

Methods in a generic class can freely use the class's type parameters, ensuring the entire API is type-safe.
