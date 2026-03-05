# Default Parameters

Named parameters can have default values, allowing callers to omit them. Default values are specified after the parameter type using `=`.

When a caller does not provide a named parameter that has a default value, the function uses the default. The caller can also explicitly pass a value to override the default.

Default parameters are ideal for cases where a fixed value is used most of the time but occasionally needs customization. They reduce the number of arguments required at the call site, making common calls more concise.

The example shows a `greet` function where the `greeting` parameter defaults to `"Hello"` and can be omitted or overridden.