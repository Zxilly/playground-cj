# Sorting

Cangjie provides built-in sorting functionality. After importing the sort module with `import std.sort.*`, you can sort arrays and collections.

The default sort order is ascending. You can also provide a custom comparison function for descending or other sort orders.

For custom types, you need to provide a comparison function to tell the sorting algorithm how to compare two elements. The sort is stable, meaning the relative order of equal elements is preserved.