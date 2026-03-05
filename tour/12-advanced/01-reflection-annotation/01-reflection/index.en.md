# TypeInfo & Reflection

Cangjie supports **reflection**, allowing programs to inspect type information at runtime. Import the reflection library with `import std.reflect.*`.

`TypeInfo` is the core type for reflection, providing access to a type's name, methods, properties, and more. Use `TypeInfo.of<T>()` to get type information for type `T`.

Common uses of reflection:
- Dynamic type inspection
- Building generic serialization/deserialization frameworks
- Implementing plugin systems

Note: Reflection incurs some performance overhead and should only be used when runtime type information is genuinely needed.

The code on the right demonstrates how to use reflection to inspect type information.