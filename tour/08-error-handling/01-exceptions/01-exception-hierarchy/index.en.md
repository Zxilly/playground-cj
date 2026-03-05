# Exception Hierarchy

Cangjie uses exceptions to handle runtime errors. `Exception` is the base class for all exceptions, providing a `message` property that describes the error.

Common built-in exception types include array index out of bounds, type cast failures, arithmetic errors, and more. All exceptions inherit from the `Exception` base class, forming a hierarchy.

Understanding the exception hierarchy helps you write more precise error handling code. You can catch specific exception types for specific error conditions, or catch the base `Exception` class to handle all exceptions.
