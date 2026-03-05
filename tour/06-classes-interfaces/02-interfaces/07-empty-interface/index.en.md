# Empty Interface

An empty interface has no method requirements. In Cangjie, the `Any` type plays a similar role -- all types are subtypes of `Any`.

An empty interface can hold values of any type, making it useful when you need to store arbitrary types. However, using an empty interface means losing type information, requiring type casting to access the concrete type's methods.

In practice, prefer specific interface types and only use empty interfaces when you truly need to store arbitrary types. Overusing empty interfaces weakens type safety.

The example shows how to use `Any` to store values of different types.
