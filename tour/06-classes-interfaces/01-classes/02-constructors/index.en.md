# Constructors

Classes define constructors using the `init` keyword. Constructors initialize all fields, ensuring the object is in a valid state after creation.

A class can have multiple constructors as long as their parameter lists differ. This allows creating instances in different ways.

Inside a constructor, use `this` to refer to the object being created. All `let` and `var` fields must be initialized in the constructor.

The example shows a `Person` class with multiple constructors.
