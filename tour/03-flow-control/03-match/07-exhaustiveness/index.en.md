# Exhaustiveness

The Cangjie compiler requires `match` expressions to be exhaustive -- all `case` branches together must cover every possible value of the matched expression.

If a `match` is not exhaustive, the compiler reports an error. This safety mechanism ensures you never miss a case.

Common ways to ensure exhaustiveness:

- Use the wildcard `_` as the last branch
- Use a binding pattern as the last branch
- For `enum` types, list all constructors

Exhaustiveness checking is an important part of Cangjie's type system safety.
