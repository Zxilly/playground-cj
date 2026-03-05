# Direct Extensions

Cangjie allows you to add new methods to existing types through **extensions**, without modifying the original type definition. This is a powerful feature that lets you add functionality to any type.

**Direct extensions** are the simplest form of extensions and don't require implementing any interface. Use the `extend` keyword followed by the type name, then define new methods inside braces.

Inside an extension, you can use `this` to refer to the instance of the extended type. Extensions can add both instance methods and static methods.

The code on the right shows how to add `isEven` and `isPositive` methods to the `Int64` type. Once defined, you can call these methods just like native ones.
