# Generic Enums

Generic enums allow enum variants to carry data of generic types. This is especially useful for representing the result of operations that may succeed or fail.

The `Option<T>` type from the standard library is a classic example of a generic enum. We can also define our own generic enums, such as a `Result<T, E>` type where the `Ok` variant carries a success value and the `Err` variant carries error information.

Generic enums are particularly powerful when combined with pattern matching, allowing you to safely handle all possible cases.