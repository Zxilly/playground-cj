# Multiple Returns (Tuples)

Cangjie functions can only have one return value, but you can return a tuple to effectively return multiple values. Tuples are lightweight data structures that group multiple values together.

Tuple types are written with element types in parentheses separated by commas, e.g., `(Int64, Int64)`. Create a tuple by placing values in parentheses.

Access tuple elements using zero-based indexing: `.0` for the first element, `.1` for the second. You can also use destructuring to bind tuple elements to separate variables at once.

In the example, the `minMax` function returns both the minimum and maximum values from an array as a tuple.