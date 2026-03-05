# Option Type

`Option<T>` is an important enum type in the Cangjie standard library, representing a value that may exist (`Some(value)`) or not (`None`).

The `Option` type is a safe way to handle potentially absent values, avoiding null pointer exceptions. Through pattern matching, you must explicitly handle the case where the value is absent.

Using `Option` makes code safer and more expressive -- it tells callers that a value might not exist and must be handled accordingly.

The example shows how to use `Option` to safely handle a lookup operation that may fail.
