# Sealed Classes

The `sealed` modifier restricts a class so it can only be inherited within the same package. Code outside the package cannot create subclasses of a `sealed` class.

This allows the compiler to check whether pattern matching covers all possible subtypes, since the set of subclasses is known and fixed.

`sealed` classes offer a middle ground between `open` classes and non-inheritable classes: allowing controlled inheritance while preventing arbitrary external extensions.

The example shows a `sealed` class definition. Since all subclasses are in the same file, the `match` expression can be exhaustive.