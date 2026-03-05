# Unit & Nothing

Cangjie has two special types: `Unit` and `Nothing`.

**Unit** has only one value: `()`. Expressions that are used for their side effects rather than their return value have type `Unit`. For example, the return type of `println()`, assignment expressions, and loop expressions are all `Unit`.

**Nothing** is a special type that contains no values and is a subtype of all types. The expressions `break`, `continue`, `return`, and `throw` have type `Nothing`, because code after these expressions will not execute.
