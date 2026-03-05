# Properties (prop)

Cangjie supports computed properties using the `prop` keyword. Properties look like fields but compute values through `get` and optional `set` methods.

Read-only properties define only `get()`, while read-write properties define both `get()` and `set()`. Properties let you control the read and write logic without changing the usage syntax.

Properties are accessed using dot syntax like regular fields, but behind the scenes they call the corresponding getter or setter methods.

The example demonstrates defining and using both read-only and read-write properties.
