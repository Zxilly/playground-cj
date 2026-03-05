# for-in Loop

The `for-in` expression iterates over collections that implement the `Iterable` interface, such as ranges and arrays.

The syntax is `for (variable in sequence) { body }`. In each iteration, the iteration variable binds to the next element in the sequence.

The iteration variable is immutable and cannot be modified inside the loop body. If you don't need the variable, use the wildcard `_` instead.

You can also add a `where` condition after the sequence to filter specific elements.
