# ArrayList

`ArrayList` is the most commonly used dynamic array type in Cangjie. It can grow and shrink at runtime without needing a predetermined size.

To use `ArrayList`, first import `std.collection.*`. When creating one, specify the element type, such as `ArrayList<Int64>()`. Common operations include `append` to add elements, subscript access, and `size` to get the length.

`ArrayList` supports insertion and deletion at any position, but operations at the end are most efficient. When frequent random access is needed, `ArrayList` is the best choice.
