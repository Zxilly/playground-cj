# Inheritance

Cangjie supports class inheritance using the `<:` syntax. A subclass inherits all fields and methods from its parent class and can add new ones.

Subclass constructors must call the parent constructor (via `super`) to initialize inherited fields.

Inheritance enables code reuse -- subclasses automatically have the parent's functionality while extending it with new behavior. Cangjie supports single inheritance only, meaning a class can have only one parent class.

The example shows an `Animal` base class with `Dog` and `Cat` subclasses.
