# Option for Null Safety

The `Option<T>` type represents a value that may or may not exist. It has two variants: `Some(value)` indicates a value is present, and `None` indicates absence.

Unlike null in other languages, `Option` is type-safe. The compiler forces you to handle the case where the value is absent, preventing null pointer errors.

When a function might not return a valid result, returning `Option<T>` is clearer and safer than returning a special value like -1 or an empty string.
