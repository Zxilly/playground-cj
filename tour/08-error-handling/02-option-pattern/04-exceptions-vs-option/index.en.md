# Exceptions vs Option

Both exceptions and `Option` can handle error conditions, but they suit different scenarios.

**Use exceptions** when the error is unexpected and should not occur in normal flow. For example, file corruption, network failures, or illegal arguments. Exceptions can carry detailed error information.

**Use Option** when "no value" is a reasonable, expected outcome. For example, looking up an element in a collection or parsing potentially invalid input. `Option` forces callers to explicitly handle the missing case.

Choosing the right error handling approach makes your code clearer and more maintainable.
