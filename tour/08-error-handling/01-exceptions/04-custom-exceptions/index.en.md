# Custom Exceptions

You can create custom exceptions by inheriting from the `Exception` class. Custom exceptions can carry additional context information, helping callers better understand and handle errors.

When creating a custom exception, you typically call `super(message)` in the constructor to set the error message. You can also add extra fields to carry more information.

Custom exceptions make error handling more precise -- callers can take different recovery strategies based on different exception types.
