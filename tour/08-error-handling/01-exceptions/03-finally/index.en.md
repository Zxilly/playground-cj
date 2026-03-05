# finally

Code in a `finally` block executes regardless of whether an exception occurred. This makes `finally` the ideal place for resource cleanup such as closing files or releasing connections.

The execution order of `try-catch-finally` is: execute the `try` block first, if an exception occurs execute the matching `catch` block, and finally execute the `finally` block no matter what.

Even if the `catch` block throws a new exception or the `try` block contains a `return` statement, the `finally` block still executes.