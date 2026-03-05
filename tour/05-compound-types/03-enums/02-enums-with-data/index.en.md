# Enums with Data

Cangjie enum members can carry associated data. Each member can have different types and numbers of associated values, making enums a powerful data modeling tool.

Enum members with data specify the data types in their definition and provide values when created. In `match` expressions, pattern matching extracts the associated data.

This pattern is similar to "tagged unions" or "algebraic data types" (ADTs) in other languages, ideal for representing data with multiple possible forms.

The example defines a `Shape` enum where each variant carries different dimension data.