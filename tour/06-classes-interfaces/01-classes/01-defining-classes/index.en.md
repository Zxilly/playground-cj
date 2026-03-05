# Defining Classes

Classes are reference types in Cangjie, used to create objects with state and behavior. They are defined with the `class` keyword.

Unlike structs, classes are reference types. Assigning a class instance to another variable creates a reference to the same object -- modifying one affects the other.

Classes can contain fields (`var` or `let`), constructors (`init`), and methods (`func`). Class methods can directly modify mutable fields without needing the `mut` modifier.

The example defines a simple `Animal` class with name and age fields along with some methods.
