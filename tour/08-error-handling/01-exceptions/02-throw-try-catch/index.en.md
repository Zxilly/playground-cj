# throw & try-catch

The `throw` keyword throws an exception, and `try-catch` catches and handles exceptions. When execution reaches a `throw` statement, the current function stops immediately and the exception propagates up the call stack until caught by a `catch` block.

A `catch` block can specify the exception type to catch. When there are multiple `catch` blocks, they are matched in order, so more specific exception types should come first.

Uncaught exceptions cause the program to terminate. Good exception handling allows programs to recover gracefully from errors.
