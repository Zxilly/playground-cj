# Arrays

Arrays are ordered collections of elements of the same type. In Cangjie, the array type is written as `Array<ElementType>`, and arrays can be created with the literal syntax `[elem1, elem2, ...]`.

Array elements are accessed using bracket indexing starting from `0`. Use the `.size` property to get the array's length.

Use `for-in` loops to iterate over all elements. Arrays can also be created using a constructor, e.g., `Array<Int64>(5, {i => i * 2})` creates an array of 5 elements.

The example shows basic array creation and access patterns.