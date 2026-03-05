# Interface Extensions

Beyond direct extensions, Cangjie supports **interface extensions** — making existing types conform to new interfaces. Using the `extend TypeName <: InterfaceName` syntax, you can add interface implementations to a type.

This is useful when:
- You want an existing type to conform to a certain interface
- The type comes from a third-party library and you cannot modify its definition
- You want to add richer behavior to a type

Interface extensions must implement all methods declared in the interface. This way, you can make any type fit into your interface hierarchy.

The code on the right defines a `Describable` interface, then uses extensions to make both `Int64` and `Bool` implement it.
