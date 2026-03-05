# Generic Structs

Generic structs allow you to define data structures that can store data of any type. Type parameters are declared in angle brackets after the struct name and can be used in the struct's fields and methods.

A common example is a `Pair` struct that holds two values of potentially different types. With generics, we only need to define the struct once to handle any combination of types.

When creating an instance of a generic struct, the compiler infers the types from the constructor arguments. The example shows how to define and use generic structs.
