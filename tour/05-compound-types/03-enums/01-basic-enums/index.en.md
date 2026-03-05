# Basic Enums

Enums define a set of named constant values. They are defined with the `enum` keyword, with members separated by `|`.

Enum members are accessed as `EnumName.MemberName`. Enums are commonly used to represent finite, mutually exclusive sets of options such as directions, colors, or states.

Use `match` expressions to pattern match on enum values, ensuring all possible cases are handled. This is the recommended way to work with enums.

The example defines a `Direction` enum and uses `match` to perform different actions based on the direction.
