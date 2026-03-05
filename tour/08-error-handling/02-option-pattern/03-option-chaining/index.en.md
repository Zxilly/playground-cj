# Option Chaining

The `Option` type provides several utility methods that support chaining to process optional values. These include `map`, `flatMap`, and `getOrDefault`.

The `map` method transforms the value if present, `flatMap` avoids nested `Option`s, and `getOrDefault` provides a fallback when the value is absent.

Chaining makes code that processes optional values more concise and fluent, avoiding deeply nested `match` expressions.
