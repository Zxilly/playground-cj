# Creating Instances

Create instances by calling a struct's constructor (`init`). The constructor parameters correspond to the fields that need initialization.

In Cangjie, constructors are invoked using the struct name followed by parentheses, similar to a function call. Each struct can define multiple constructors to support different initialization patterns.

Since structs are value types, assignment creates an independent copy. Modifying the copy does not affect the original instance.

The example shows how to create struct instances and demonstrates the copy behavior of value types.
