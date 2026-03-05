# Type Aliases

Type aliases use the `type` keyword to create a new name for an existing type. This is especially useful when generic types become complex, improving code readability.

A type alias does not create a new type -- it is just another name for an existing type. This means the aliased type and the original type can be used interchangeably.

Common uses include creating short names for generic collections with specific type parameters, such as aliasing `ArrayList<String>` to `StringList`.