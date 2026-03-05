# Binding Pattern

A binding pattern uses an identifier to match any value and binds that value to the identifier, making it available in the code after `=>`.

Since binding patterns match any value, they are often used as the last branch in a `match` expression as a catch-all, while still providing access to the matched value (more useful than the `_` wildcard).

Bound variables are immutable.
