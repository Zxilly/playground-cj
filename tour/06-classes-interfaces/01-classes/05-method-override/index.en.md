# Method Override

Subclasses can override parent class methods to provide different implementations. Parent methods must be marked `open` to be overridable, and subclasses use the `override` keyword.

The `open` and `override` pair ensures that method overriding is intentional, preventing accidental overrides. If a parent method is not marked `open`, subclasses cannot override it.

Overridden methods are dispatched at runtime based on the object's actual type -- even when referenced through a parent type variable, the subclass implementation is called. This is runtime polymorphism.

The example demonstrates method overriding and runtime polymorphic behavior.