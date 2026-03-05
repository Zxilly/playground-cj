# Closures

Closures are functions that capture variables from their defining environment. Both lambda expressions and nested functions can form closures.

When a lambda references variables from an outer scope, it "captures" those variables. The captured variables remain accessible when the lambda is called, even after the original scope has ended.

A classic use of closures is creating "factory functions" -- functions that return functions. Each call to the factory creates a new closure with its own independent captured variables.

The example shows how closures capture variables and how to use closures to create counters.
